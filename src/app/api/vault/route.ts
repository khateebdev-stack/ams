import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET: Fetch encrypted items for the user, optionally filtered by vaultId
export async function GET(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const vaultId = searchParams.get('vaultId');

    // MIGRATION LAYER: Check for items without vaultId and migrate to default vault if possible
    const legacyCount = await prisma.accountEntry.count({
        where: { userId: user.id, vaultId: null }
    });

    if (legacyCount > 0) {
        // Find or create default "Personal" vault
        let personalVault = await prisma.vault.findFirst({
            where: { userId: user.id, name: 'Personal' }
        });

        if (personalVault) {
            await prisma.accountEntry.updateMany({
                where: { userId: user.id, vaultId: null },
                data: { vaultId: personalVault.id }
            });
            console.log(`Migrated ${legacyCount} items to vault ${personalVault.id}`);
        }
    }

    const whereClause: any = { userId: user.id };
    if (vaultId) {
        whereClause.vaultId = vaultId;
    }

    const items = await prisma.accountEntry.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            vaultId: true,
            encryptedData: true,
            iv: true,
            updatedAt: true,
        }
    });

    return NextResponse.json({ items });
}

// POST: Add a new encrypted item to a specific vault
export async function POST(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const body = await req.json();
        const { encryptedData, iv, vaultId, blindIndex } = body;

        if (!encryptedData || !iv || !vaultId) {
            return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }

        const newItem = await prisma.accountEntry.create({
            data: {
                userId: user.id,
                vaultId,
                encryptedData,
                iv,
                blindIndex
            },
        });

        return NextResponse.json({ success: true, item: newItem });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save item' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const url = new URL(req.url);
        const id = url.pathname.split('/').pop();
        const { encryptedData, iv, blindIndex } = await req.json();

        await prisma.accountEntry.update({
            where: { id, userId: user.id },
            data: { encryptedData, iv, blindIndex }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const url = new URL(req.url);
        const id = url.pathname.split('/').pop();

        await prisma.accountEntry.delete({
            where: { id, userId: user.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
