import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

const rpID = 'localhost';
const origin = `http://${rpID}:3000`;

export async function POST(req: Request) {
    try {
        const user = await getUserFromSession(req);
        if (!user) return unauthorized();

        const body = await req.json();
        const { wrappedKey } = body;

        // 1. Get stored challenge
        if (!user.currentChallenge) {
            return NextResponse.json({ error: 'Missing challenge' }, { status: 400 });
        }

        // 2. Verify Registration
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: user.currentChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        const { verified, registrationInfo } = verification;

        if (verified && registrationInfo) {
            const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

            // 3. Save Passkey to DB
            await (prisma as any).passkey.create({
                data: {
                    userId: user.id,
                    credentialId: credential.id,
                    publicKey: Buffer.from(credential.publicKey).toString('base64'),
                    counter: Number(credential.counter),
                    deviceType: credentialDeviceType,
                    backedUp: credentialBackedUp,
                    transports: body.response.transports?.join(',') || '',
                    wrappedKey: wrappedKey || null, // Hardware-bound VaultKey
                },
            });

            // 4. Clear challenge
            await prisma.user.update({
                where: { id: user.id },
                data: { currentChallenge: null }
            });

            return NextResponse.json({ verified: true });
        }

        return NextResponse.json({ verified: false }, { status: 400 });

    } catch (error: any) {
        console.error('Passkey Verification Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
