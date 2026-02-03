import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    try {
        const logs = await db.auditLog.findMany({
            where: { username },
            orderBy: { createdAt: 'desc' },
            take: 50 // Last 50 events
        });
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, event, metadata } = body;

        if (!username || !event) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const log = await db.auditLog.create({
            data: { username, event, metadata }
        });

        return NextResponse.json(log);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
    }
}
