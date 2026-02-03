import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
        where: { username }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
        salt: user.salt,
        recoverySalt: user.recoverySalt,
        recoveryVaultKey: user.recoveryVaultKey,
        encryptedVaultKey: user.encryptedVaultKey,
        encryptedRecoveryKey: user.encryptedRecoveryKey
    });
}
