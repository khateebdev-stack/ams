import { db as prisma } from '@/lib/db';
import { getUserFromSession, unauthorized } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET: Fetch all sub-vaults for the user
export async function GET(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    const vaults = await prisma.vault.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            name: true,
            icon: true,
            encryptedSubKey: true,
            iv: true,
            createdAt: true,
            updatedAt: true,
        }
    });

    return NextResponse.json({ vaults });
}

// POST: Create a new sub-vault
export async function POST(req: Request) {
    const user = await getUserFromSession(req);
    if (!user) return unauthorized();

    try {
        const body = await req.json();
        const { name, icon, encryptedSubKey, iv } = body;

        if (!name || !encryptedSubKey || !iv) {
            return NextResponse.json({ error: 'Missing vault details' }, { status: 400 });
        }

        const newVault = await prisma.vault.create({
            data: {
                userId: user.id,
                name,
                icon: icon || 'Lock',
                encryptedSubKey,
                iv,
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'VAULT_CREATED',
                ipAddress: req.headers.get('x-forwarded-for'),
                userAgent: req.headers.get('user-agent')
            }
        });

        return NextResponse.json({ success: true, vault: newVault });
    } catch (error) {
        console.error('Vault Creation Error:', error);
        return NextResponse.json({ error: 'Failed to create vault' }, { status: 500 });
    }
}
