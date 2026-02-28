import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return unauthorized();
    }

    const token = authHeader.split(' ')[1];
    const session = await (prisma as any).session.findUnique({
        where: { tokenHash: token }
    });

    if (!session || session.expiresAt < new Date()) {
        return unauthorized();
    }

    return NextResponse.json({
        threatLevel: session.threatLevel,
        isLockedDown: session.isLockedDown,
        expiresAt: session.expiresAt
    });
}
