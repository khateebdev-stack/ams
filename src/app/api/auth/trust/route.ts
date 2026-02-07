import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const session = await db.session.findUnique({
            where: { tokenHash: token },
            include: { user: true }
        });

        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const trustTokens = await db.trustToken.findMany({
            where: { userId: session.userId }
        });

        // Current device fingerprint for UI highlighting
        const currentFingerprint = req.headers.get('x-device-fingerprint');

        return NextResponse.json({
            trustTokens: trustTokens.map((t: any) => ({
                id: t.id,
                deviceName: t.deviceName || 'Unknown Device',
                fingerprintHash: t.fingerprintHash,
                expiresAt: t.expiresAt,
                createdAt: t.createdAt,
                isCurrent: t.fingerprintHash === currentFingerprint
            }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const { searchParams } = new URL(req.url);
        const tokenId = searchParams.get('id');
        const wipeAll = searchParams.get('all') === 'true';

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const session = await db.session.findUnique({
            where: { tokenHash: token }
        });

        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (wipeAll) {
            await db.trustToken.delete({ where: { userId: session.userId } });
            await db.auditLog.create({
                data: { username: session.userId, event: 'DEVICE_TRUST_WIPE_ALL' } // username field is used as ID in some logs, but here it's cleaner to use actual username if known. But sessions.user is included in my db.ts findUnique if requested.
            });
        } else if (tokenId) {
            // Verify ownership
            const trustToken = await db.trustToken.findUnique({ where: { id: tokenId } });
            if (!trustToken || trustToken.userId !== session.userId) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
            await db.trustToken.delete({ where: { id: tokenId } });
            await db.auditLog.create({
                data: { username: session.userId, event: 'DEVICE_TRUST_REVOKED', metadata: { device: trustToken.deviceName } }
            });
        } else {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
