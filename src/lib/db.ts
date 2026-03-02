import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Lazy initialization prevents Next.js from crashing during the build phase's static tracking
function getPrismaClient() {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        });
    }
    return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
    get(_, prop) {
        return (getPrismaClient() as any)[prop];
    }
});

if (process.env.NODE_ENV !== 'production') {
    // Only bind globally if not in production to prevent hot-reload memory leaks
    if (!globalForPrisma.prisma) getPrismaClient();
}

// Mock-Compatible Adapter for Zero-Friction Migration (Lazy Evaluated)
export const db: any = {
    get user() { return prisma.user; },
    get vault() { return prisma.vault; },
    get session() { return prisma.session; },
    get accountEntry() { return prisma.accountEntry; },
    get auditLog() { return prisma.auditLog; },
    get passkey() { return prisma.passkey; },
    trustToken: {
        findUnique: async (args: any) => {
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

