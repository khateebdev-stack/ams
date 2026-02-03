import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import speakeasy from 'speakeasy';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const { username, code, authHash } = await req.json();

        if (!username || !code || !authHash) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // 1. Fetch User
        const user = await db.user.findUnique({
            where: { username },
        });

        if (!user || !user.twoFactorEnabled) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Validate Auth Hash again
        if (user.authHash !== authHash) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 3. Verify TOTP Code
        const isValid = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 1
        });

        if (!isValid) {
            await db.auditLog.create({
                data: { username, event: 'LOGIN_2FA_FAILURE' }
            });
            return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 });
        }

        // Log success
        await db.auditLog.create({ data: { username, event: 'LOGIN_SUCCESS_2FA' } });

        // 4. Create Session
        const sessionToken = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await db.session.create({
            data: {
                userId: user.id,
                tokenHash: sessionToken,
                expiresAt,
            },
        });

        return NextResponse.json({
            success: true,
            sessionToken,
            twoFactorEnabled: user.twoFactorEnabled,
            encryptedVaultKey: user.encryptedVaultKey,
            encryptedRecoveryKey: user.encryptedRecoveryKey
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
