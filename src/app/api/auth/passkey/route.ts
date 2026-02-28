import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const user = await getUserFromSession(req);
        if (!user) return unauthorized();

        const passkeys = await prisma.passkey.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                credentialId: true,
                deviceType: true,
                backedUp: true,
                createdAt: true,
            }
        });

        return NextResponse.json(passkeys);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const user = await getUserFromSession(req);
        if (!user) return unauthorized();

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.passkey.delete({
            where: { id, userId: user.id }
        });

        await prisma.auditLog.create({
            data: { username: user.username, event: 'PASSKEY_REVOKED' }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
