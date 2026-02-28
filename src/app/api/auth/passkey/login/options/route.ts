import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { db as prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const rpID = 'localhost';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { username } = body;

        let allowCredentials = undefined;

        // If username is provided, we can restrict to their passkeys
        if (username) {
            const user = await prisma.user.findUnique({
                where: { username }
            });

            if (user) {
                const userPasskeys = await prisma.passkey.findMany({
                    where: { userId: user.id }
                });

                if (userPasskeys.length > 0) {
                    allowCredentials = userPasskeys.map((pk: any) => ({
                        id: pk.credentialId, // Passkey ID is already base64url encoded
                        type: 'public-key' as const,
                        transports: pk.transports ? (pk.transports.split(',') as AuthenticatorTransport[]) : undefined,
                    }));
                }
            }
        }

        // Generate Authentication Options
        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials,
            userVerification: 'discouraged',
            extensions: {
                prf: {
                    eval: {
                        first: new Uint8Array(32).fill(1).buffer,
                    },
                },
            },
        } as any);

        // Save challenge in cookie for true passwordless login (no username needed)
        const cookieStore = await cookies();
        cookieStore.set('passkey_challenge', options.challenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 300 // 5 minutes
        });

        // Actually, WebAuthn challenges for login are usually handled by storing the challenge
        // in a short-lived session or cookie. Since Axiom has a `currentChallenge` field in `User`,
        // let's use that if username is provided.
        if (username) {
            await prisma.user.update({
                where: { username },
                data: { currentChallenge: options.challenge }
            });
        }

        // If no username is provided, we'd need a different way to store the challenge.
        // For now, let's assume the user enters their username for Passkey login too.

        return NextResponse.json(options);

    } catch (error: any) {
        console.error('Passkey Login Options Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
