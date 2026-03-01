import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Mock-Compatible Adapter for Zero-Friction Migration
export const db: any = {
    user: prisma.user,
    vault: prisma.vault,
    session: prisma.session,
    accountEntry: prisma.accountEntry,
    auditLog: prisma.auditLog,
    passkey: prisma.passkey,
    trustToken: {
        findUnique: async (args: any) => {
            // Map legacy { userId, fingerprintHash } to Prisma's compound unique index
            if (args.where && args.where.userId && args.where.fingerprintHash && !args.where.userId_fingerprintHash) {
                return prisma.trustToken.findUnique({
                    ...args,
                    where: {
                        userId_fingerprintHash: {
                            userId: args.where.userId,
                            fingerprintHash: args.where.fingerprintHash,
                        }
                    }
                });
            }
            return prisma.trustToken.findUnique(args);
        },
        findMany: (args: any) => prisma.trustToken.findMany(args),
        create: (args: any) => prisma.trustToken.create(args),
        delete: async (args: any) => {
            if (args.where && args.where.userId && args.where.fingerprintHash && !args.where.userId_fingerprintHash) {
                return prisma.trustToken.delete({
                    where: {
                        userId_fingerprintHash: {
                            userId: args.where.userId,
                            fingerprintHash: args.where.fingerprintHash,
                        }
                    }
                });
            } else if (args.where && args.where.userId && !args.where.id) {
                return prisma.trustToken.deleteMany({
                    where: { userId: args.where.userId }
                });
            }
            return prisma.trustToken.delete(args);
        }
    }
};

