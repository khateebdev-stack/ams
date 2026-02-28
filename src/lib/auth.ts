import { db as prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function getUserFromSession(req: Request) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];

    const session = await (prisma as any).session.findUnique({
        where: { tokenHash: token }, // In real app, hash the incoming token first
        include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
        return null;
    }

    // Attach session metadata to user for downstream logic
    const user = session.user;
    (user as any).sessionIsLockedDown = session.isLockedDown;
    (user as any).sessionThreatLevel = session.threatLevel;

    return user;
}

export function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
