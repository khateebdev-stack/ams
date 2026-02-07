import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_PATH, 'db.json');

// Ensure DB directory and file exist
if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sessions: [], items: [], auditLogs: [] }, null, 2));
}

interface DB {
    users: any[];
    sessions: any[];
    items: any[];
    vaults: any[]; // New
    auditLogs: any[];
    trustTokens: any[];
}

function readDB(): DB {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return {
            users: parsed.users || [],
            sessions: parsed.sessions || [],
            items: parsed.items || [],
            vaults: parsed.vaults || [],
            auditLogs: parsed.auditLogs || [],
            trustTokens: parsed.trustTokens || []
        };
    } catch (e) {
        return { users: [], sessions: [], items: [], vaults: [], auditLogs: [], trustTokens: [] };
    }
}

function writeDB(data: DB) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
    user: {
        findUnique: async ({ where }: any) => {
            const db = readDB();
            return db.users.find(u => u.username === where.username || u.id === where.id) || null;
        },
        create: async ({ data }: any) => {
            const db = readDB();
            const newUser = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
            db.users.push(newUser);
            writeDB(db);
            return newUser;
        },
        update: async ({ where, data }: any) => {
            const db = readDB();
            const index = db.users.findIndex(u => u.username === where.username || u.id === where.id);
            if (index === -1) throw new Error("User not found");
            db.users[index] = { ...db.users[index], ...data };
            writeDB(db);
            return db.users[index];
        },
        delete: async ({ where }: any) => {
            const db = readDB();
            db.users = db.users.filter(u => u.id !== where.id && u.username !== where.username);
            db.sessions = db.sessions.filter(s => s.userId !== where.id);
            db.items = db.items.filter(i => i.userId !== where.id);
            db.vaults = db.vaults.filter(v => v.userId !== where.id);
            writeDB(db);
            return true;
        }
    },
    vault: {
        findMany: async ({ where }: any) => {
            const db = readDB();
            return db.vaults.filter(v => v.userId === where.userId);
        },
        findFirst: async ({ where }: any) => {
            const db = readDB();
            return db.vaults.find(v => v.userId === where.userId && (v.id === where.id || v.name === where.name)) || null;
        },
        findUnique: async ({ where }: any) => {
            const db = readDB();
            return db.vaults.find(v => v.id === where.id && v.userId === where.userId) || null;
        },
        create: async ({ data }: any) => {
            const db = readDB();
            const newVault = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
            db.vaults.push(newVault);
            writeDB(db);
            return newVault;
        }
    },
    session: {
        findUnique: async ({ where, include }: any) => {
            const db = readDB();
            const session = db.sessions.find(s => s.tokenHash === where.tokenHash);
            if (!session) return null;
            if (include?.user) {
                session.user = db.users.find(u => u.id === session.userId);
            }
            return session;
        },
        create: async ({ data }: any) => {
            const db = readDB();
            const newSession = { id: crypto.randomUUID(), ...data };
            db.sessions.push(newSession);
            writeDB(db);
            return newSession;
        },
        delete: async ({ where }: any) => {
            const db = readDB();
            db.sessions = db.sessions.filter(s => s.tokenHash !== where.tokenHash);
            writeDB(db);
            return true;
        }
    },
    accountEntry: {
        count: async ({ where }: any) => {
            const db = readDB();
            return db.items.filter(i => {
                return Object.entries(where).every(([key, value]) => i[key] === value);
            }).length;
        },
        findMany: async ({ where, orderBy, select }: any) => {
            const db = readDB();
            let items = db.items.filter(i => {
                return Object.entries(where).every(([key, value]) => i[key] === value);
            });
            return items;
        },
        findFirst: async ({ where }: any) => {
            const db = readDB();
            return db.items.find(i => i.id === where.id && i.userId === where.userId) || null;
        },
        create: async ({ data }: any) => {
            const db = readDB();
            const newItem = {
                id: crypto.randomUUID(),
                ...data,
                blindIndex: data.blindIndex || null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            db.items.push(newItem);
            writeDB(db);
            return newItem;
        },
        update: async ({ where, data }: any) => {
            const db = readDB();
            const index = db.items.findIndex(i => {
                const matchId = i.id === where.id;
                const matchUser = where.userId ? i.userId === where.userId : true;
                return matchId && matchUser;
            });
            if (index === -1) throw new Error("Item not found");

            db.items[index] = { ...db.items[index], ...data, updatedAt: new Date() };
            if (data.blindIndex !== undefined) db.items[index].blindIndex = data.blindIndex;
            writeDB(db);
            return db.items[index];
        },
        updateMany: async ({ where, data }: any) => {
            const db = readDB();
            let count = 0;
            db.items = db.items.map(i => {
                const match = Object.entries(where).every(([key, value]) => i[key] === value);
                if (match) {
                    count++;
                    return { ...i, ...data, updatedAt: new Date() };
                }
                return i;
            });
            writeDB(db);
            return { count };
        },
        delete: async ({ where }: any) => {
            const db = readDB();
            db.items = db.items.filter(i => {
                const matchId = i.id === where.id;
                const matchUser = where.userId ? i.userId === where.userId : true;
                return !(matchId && matchUser);
            });
            writeDB(db);
            return true;
        }
    },
    auditLog: {
        create: async (payload: { data: any }) => {
            const db = readDB();
            const newLog = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                ...payload.data
            };
            db.auditLogs.push(newLog);
            writeDB(db);
            return newLog;
        },
        findMany: async (payload?: { where?: any, orderBy?: any, take?: number }) => {
            const db = readDB();
            let logs = db.auditLogs || [];
            if (payload?.where) {
                logs = logs.filter(log => {
                    return Object.entries(payload.where).every(([key, value]) => log[key] === value);
                });
            }
            if (payload?.orderBy) {
                const [field, direction] = Object.entries(payload.orderBy)[0] as [string, string];
                logs.sort((a, b) => {
                    const valA = a[field];
                    const valB = b[field];
                    if (direction === 'desc') return valB > valA ? 1 : -1;
                    return valA > valB ? 1 : -1;
                });
            }
            if (payload?.take) {
                logs = logs.slice(0, payload.take);
            }
            return logs;
        }
    },
    trustToken: {
        findUnique: async ({ where }: any) => {
            const db = readDB();
            return db.trustTokens.find(t => t.id === where.id || (t.userId === where.userId && t.fingerprintHash === where.fingerprintHash)) || null;
        },
        findMany: async ({ where }: any) => {
            const db = readDB();
            return db.trustTokens.filter(t => t.userId === where.userId);
        },
        create: async ({ data }: any) => {
            const db = readDB();
            const newToken = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
            db.trustTokens.push(newToken);
            writeDB(db);
            return newToken;
        },
        delete: async ({ where }: any) => {
            const db = readDB();
            if (where.id) {
                db.trustTokens = db.trustTokens.filter(t => t.id !== where.id);
            } else if (where.userId && where.fingerprintHash) {
                db.trustTokens = db.trustTokens.filter(t => !(t.userId === where.userId && t.fingerprintHash === where.fingerprintHash));
            } else if (where.userId) {
                db.trustTokens = db.trustTokens.filter(t => t.userId !== where.userId);
            }
            writeDB(db);
            return true;
        }
    }
};
