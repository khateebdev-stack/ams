import { db as prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const session = await prisma.session.findUnique({
            where: { tokenHash: token },
            include: { user: true }
        });

        if (!session) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const body = await req.json();
        const { event, details, severity = 1 } = body;

        // 1. Log the threat event
        await prisma.auditLog.create({
            data: {
                userId: session.userId,
                action: `THREAT_DETECTED: ${event}`,
                ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
                userAgent: req.headers.get('user-agent') || 'unknown',
            }
        });

        // 2. Increment session threat level
        const newThreatLevel = session.threatLevel + severity;
        const shouldLockdown = newThreatLevel >= 3;

        await (prisma as any).session.update({
            where: { id: session.id },
            data: {
                threatLevel: newThreatLevel,
                isLockedDown: shouldLockdown || session.isLockedDown
            }
        });

        return NextResponse.json({
            success: true,
            threatLevel: newThreatLevel,
            isLockedDown: shouldLockdown || session.isLockedDown
        });

    } catch (error: any) {
        console.error('Threat Report Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
