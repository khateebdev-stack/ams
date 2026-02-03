import { db as prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function getUserFromSession(req: Request) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];

    const session = await prisma.session.findUnique({
        where: { tokenHash: token }, // In real app, hash the incoming token first
        include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
        return null;
    }

    return session.user;
}

export function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
