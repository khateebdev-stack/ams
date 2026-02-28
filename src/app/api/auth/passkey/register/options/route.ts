import { generateRegistrationOptions } from '@simplewebauthn/server';
import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

const rpName = 'Axiom';
const rpID = 'localhost';
const origin = `http://${rpID}:3000`;

export async function POST(req: Request) {
    try {
        const user = await getUserFromSession(req);
        if (!user) return unauthorized();

        // 1. Get user's existing passkeys to prevent re-registration
        const userPasskeys = await prisma.passkey.findMany({
            where: { userId: user.id }
        });

        // 2. Generate Registration Options
        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: new TextEncoder().encode(user.id),
            userName: user.username,
            // Don't prevent re-registration yet if we want multiple keys,
            // but for now let's avoid duplicates
            excludeCredentials: userPasskeys.map((pk: any) => ({
                id: Buffer.from(pk.credentialId, 'base64'),
                type: 'public-key',
                transports: pk.transports ? (pk.transports.split(',') as AuthenticatorTransport[]) : undefined,
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'discouraged',
                authenticatorAttachment: 'cross-platform', // Allow YubiKeys/Phones
            },
            // THE PRF EXTENSION: This is critical for our Master Key Wrap
            extensions: {
                prf: {
                    eval: {
                        first: crypto.getRandomValues(new Uint8Array(32)),
                    },
                },
            },
        } as any);

        // 3. Save challenge to DB
        await prisma.user.update({
            where: { id: user.id },
            data: { currentChallenge: options.challenge }
        });

        return NextResponse.json(options);

    } catch (error: any) {
        console.error('Passkey Options Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
