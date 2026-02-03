import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, authHash, salt, encryptedVaultKey } = body;

        if (!username || !authHash || !salt || !encryptedVaultKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const user = await db.user.findUnique({ where: { username } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update user with NEW master password data
        // We leave recoverySalt and recoveryVaultKey as they ARE (unless we want to refresh them, but that requires re-deriving from recovery key)
        // For now, simple password reset is the priority.
        const updatedUser = {
            ...user,
            authHash,
            salt,
            encryptedVaultKey,
            updatedAt: new Date().toISOString()
        };

        const dbData = JSON.parse(require('fs').readFileSync(require('path').join(process.cwd(), 'data', 'db.json'), 'utf-8'));
        const userIndex = dbData.users.findIndex((u: any) => u.username === username);
        dbData.users[userIndex] = updatedUser;
        require('fs').writeFileSync(require('path').join(process.cwd(), 'data', 'db.json'), JSON.stringify(dbData, null, 2));

        await db.auditLog.create({ data: { username, event: 'PASSWORD_RESET_RECOVERY' } });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
