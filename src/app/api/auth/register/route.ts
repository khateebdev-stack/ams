import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            username,
            salt,
            authHash,
            encryptedVaultKey,
            encryptedRecoveryKey,
            recoverySalt,
            recoveryVaultKey
        } = body;

        // Validate inputs
        if (!username || !salt || !authHash || !encryptedVaultKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user exists
        const existingUser = await db.user.findUnique({
            where: { username },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
        }

        // Create User
        const user = await db.user.create({
            data: {
                username,
                salt,
                authHash,
                encryptedVaultKey,
                encryptedRecoveryKey,
                recoverySalt,
                recoveryVaultKey
            },
        });

        await db.auditLog.create({ data: { username, event: 'REGISTRATION_SUCCESS' } });

        return NextResponse.json({
            success: true,
            userId: user.id
        });

    } catch (error: any) {
        console.error('Registration Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
