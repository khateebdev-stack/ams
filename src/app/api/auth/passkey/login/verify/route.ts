import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db as prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

const rpID = 'localhost';
const origin = `http://${rpID}:3000`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username } = body; // Optional, but helpful if user provided it

        // 1. Find the Passkey in DB
        const credentialIdBase64 = body.id;
        const passkey = await (prisma as any).passkey.findUnique({
            where: { credentialId: credentialIdBase64 }
        });

        if (!passkey) {
            console.error('Passkey not found for ID:', credentialIdBase64);
            return NextResponse.json({ error: 'Passkey not recognized' }, { status: 401 });
        }

        console.log('Comparing Credential ID:', credentialIdBase64, 'with DB:', passkey.credentialId);

        const user = await prisma.user.findUnique({
            where: { id: passkey.userId }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // 2. Get stored challenge
        const cookieStore = await cookies();
        const cookieChallenge = cookieStore.get('passkey_challenge')?.value;
        const expectedChallenge = cookieChallenge || user.currentChallenge;

        if (!expectedChallenge) {
            return NextResponse.json({ error: 'Missing challenge - please refresh and try again' }, { status: 400 });
        }

        // 3. Verify Authentication
        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge: expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: passkey.credentialId,
                publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
                counter: passkey.counter,
                transports: passkey.transports ? (passkey.transports.split(',') as any[]) : undefined,
            },
            requireUserVerification: false,
        });

        const { verified, authenticationInfo } = verification;

        if (verified && authenticationInfo) {
            // 4. Update passkey counter
            await (prisma as any).passkey.update({
                where: { id: passkey.id },
                data: { counter: Number(authenticationInfo.newCounter) }
            });

            // 5. Clear challenge
            await prisma.user.update({
                where: { id: user.id },
                data: { currentChallenge: null }
            });

            // 6. Create Session (Same logic as login/route.ts)
            const sessionToken = randomUUID();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await prisma.session.create({
                data: {
                    userId: user.id,
                    tokenHash: sessionToken,
                    expiresAt,
                },
            });

            // Log Success
            await prisma.auditLog.create({
                data: { username: user.username, event: 'LOGIN_PASSKEY_SUCCESS' }
            });

            return NextResponse.json({
                success: true,
                verified: true,
                sessionToken,
                username: user.username,
                encryptedVaultKey: user.encryptedVaultKey,
                encryptedRecoveryKey: user.encryptedRecoveryKey,
                wrappedKey: passkey.wrappedKey // The key wrapped with PRF
            });
        }

        return NextResponse.json({ verified: false }, { status: 401 });

    } catch (error: any) {
        console.error('Passkey Login Verification Error:', error.message);
        if (error.name === 'InvalidStateError' || error.name === 'NotAllowedError') {
            console.error('Passkey Error Details:', error);
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
