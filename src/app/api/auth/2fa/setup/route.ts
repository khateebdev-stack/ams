import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
    try {
        const username = req.nextUrl.searchParams.get('username');
        const token = req.headers.get('authorization')?.split(' ')[1];

        if (!username || !token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify session
        const session = await db.session.findUnique({
            where: { tokenHash: token },
            include: { user: true }
        });

        if (!session || session.user.username !== username) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `SecureVault:${username}`,
            issuer: 'SecureVault',
            otpauth_url: true
        });

        // Use secret.otpauth_url if present, otherwise construct manually
        const otpauth = secret.otpauth_url || `otpauth://totp/SecureVault:${username}?secret=${secret.base32}&issuer=SecureVault`;
        console.log('Generated OTPAuth URL:', otpauth);

        // Generate QR Code as DataURL
        const qrCodeUrl = await QRCode.toDataURL(otpauth);
        console.log('Generated QR Code URL length:', qrCodeUrl.length);

        // Save temporary secret to user
        await db.user.update({
            where: { username },
            data: { tempTwoFactorSecret: secret.base32 }
        });

        return NextResponse.json({
            secret: secret.base32,
            qrCodeUrl
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
