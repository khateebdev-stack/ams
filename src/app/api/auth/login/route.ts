import { db as prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, authHash } = body;

        if (!username || !authHash) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        // 1. Fetch User
        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            await prisma.auditLog.create({ data: { username, event: 'LOGIN_FAILURE', metadata: { reason: 'User not found' } } });
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // 2. Validate Auth Hash (Zero-Knowledge Proof)
        if (user.authHash !== authHash) {
            await prisma.auditLog.create({ data: { username, event: 'LOGIN_FAILURE', metadata: { reason: 'Invalid hash' } } });
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // 2b. Check 2FA & Device Trust
        if (user.twoFactorEnabled) {
            const { trustToken, fingerprint } = body;
            let isTrusted = false;

            if (trustToken && fingerprint) {
                const storedTrust = await prisma.trustToken.findUnique({
                    where: { userId: user.id, fingerprintHash: fingerprint }
                });

                if (storedTrust && storedTrust.token === trustToken) {
                    const expiry = new Date(storedTrust.expiresAt);
                    if (expiry > new Date()) {
                        isTrusted = true;
                        await prisma.auditLog.create({ data: { username, event: 'LOGIN_TRUSTED_BYPASS' } });
                    } else {
                        // Cleanup expired token
                        await prisma.trustToken.delete({ where: { id: storedTrust.id } });
                    }
                }
            }

            if (!isTrusted) {
                await prisma.auditLog.create({ data: { username, event: 'LOGIN_2FA_PENDING' } });
                return NextResponse.json({
                    success: true,
                    twoFactorRequired: true,
                    username: user.username
                });
            }
        }

        // Log success
        await prisma.auditLog.create({ data: { username, event: 'LOGIN_SUCCESS' } });

        // 3. Create Session
        const sessionToken = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.session.create({
            data: {
                userId: user.id,
                tokenHash: sessionToken,
                expiresAt,
            },
        });

        // 4. Return the Encrypted Keys
        return NextResponse.json({
            success: true,
            sessionToken,
            twoFactorEnabled: user.twoFactorEnabled,
            encryptedVaultKey: user.encryptedVaultKey,
            encryptedRecoveryKey: user.encryptedRecoveryKey
        });

    } catch (error: any) {
        console.error('Login Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
