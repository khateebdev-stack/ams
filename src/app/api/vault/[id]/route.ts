import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;
        const body = await req.json();
        const { encryptedData, iv } = body;

        // Verify ownership
        const existing = await prisma.accountEntry.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const updated = await prisma.accountEntry.update({
            where: { id },
            data: {
                encryptedData,
                iv,
            },
        });

        await prisma.auditLog.create({ data: { username: user.username, event: 'ITEM_UPDATED', metadata: { itemId: id } } });

        return NextResponse.json({ success: true, item: updated });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;

        const existing = await prisma.accountEntry.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        await prisma.accountEntry.delete({
            where: { id },
        });

        await prisma.auditLog.create({ data: { username: user.username, event: 'ITEM_DELETED', metadata: { itemId: id } } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
