import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET: Fetch all encrypted items for the user
export async function GET(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    const items = await prisma.accountEntry.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            encryptedData: true,
            iv: true,
            lastAccessedAt: true,
            updatedAt: true,
        }
    });

    await prisma.auditLog.create({ data: { username: user.username, event: 'VAULT_ACCESS', metadata: { itemCount: items.length } } });

    return NextResponse.json({ items });
}

// POST: Add a new encrypted item
export async function POST(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const body = await req.json();
        const { encryptedData, iv } = body;

        if (!encryptedData || !iv) {
            return NextResponse.json({ error: 'Missing encrypted data' }, { status: 400 });
        }

        const newItem = await prisma.accountEntry.create({
            data: {
                userId: user.id,
                encryptedData,
                iv,
            },
        });

        await prisma.auditLog.create({ data: { username: user.username, event: 'ITEM_CREATED', metadata: { itemId: newItem.id } } });

        return NextResponse.json({ success: true, item: newItem });
    } catch (error) {
        console.error('Vault Save Error:', error);
        return NextResponse.json({ error: 'Failed to save item' }, { status: 500 });
    }
}
