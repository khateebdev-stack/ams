import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import speakeasy from 'speakeasy';

export async function POST(req: NextRequest) {
    try {
        const { username, code } = await req.json();
        const token = req.headers.get('authorization')?.split(' ')[1];

        if (!username || !code || !token) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Verify session
        const session = await db.session.findUnique({
            where: { tokenHash: token },
            include: { user: true }
        });

        if (!session || session.user.username !== username) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = session.user;
        const secret = user.tempTwoFactorSecret;

        if (!secret) {
            return NextResponse.json({ error: '2FA setup not initiated' }, { status: 400 });
        }

        // Verify code
        const isValid = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 1 // Allow for minor time drift
        });

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 400 });
        }

        // Enable 2FA
        await db.user.update({
            where: { username },
            data: {
                twoFactorEnabled: true,
                twoFactorSecret: secret,
                tempTwoFactorSecret: null
            }
        });

        // Log the event
        await db.auditLog.create({
            data: { username, event: '2FA_ENABLED' }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
