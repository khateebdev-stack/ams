import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import speakeasy from 'speakeasy';

export async function POST(req: NextRequest) {
    try {
        const { username, authHash, code } = await req.json();
        const token = req.headers.get('authorization')?.split(' ')[1];

        if (!username || !authHash || !token) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // 1. Verify session
        const session = await db.session.findUnique({
            where: { tokenHash: token },
            include: { user: true }
        });

        if (!session || session.user.username !== username) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = session.user;

        // 2. Verify Master Password (Auth Hash)
        if (user.authHash !== authHash) {
            return NextResponse.json({ error: 'Incorrect Master Password' }, { status: 401 });
        }

        // 3. Verify 2FA if enabled
        if (user.twoFactorEnabled) {
            if (!code) {
                return NextResponse.json({ error: '2FA code required' }, { status: 400 });
            }

            const isValid = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: code,
                window: 1
            });

            if (!isValid) {
                return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 });
            }
        }

        // 4. Perform Wipe (Cascade delete implemented in db.ts)
        await db.user.delete({
            where: { id: user.id }
        });

        // 5. Log final event
        await db.auditLog.create({
            data: { username, event: 'ACCOUNT_DELETED', metadata: { method: 'confirm_modal' } }
        });

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
