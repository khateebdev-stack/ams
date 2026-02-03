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
    auditLogs: any[];
}

function readDB(): DB {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { users: [], sessions: [], items: [], auditLogs: [] };
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
            // Also cleanup related data
            db.sessions = db.sessions.filter(s => s.userId !== where.id);
            db.items = db.items.filter(i => i.userId !== where.id);
            writeDB(db);
            return true;
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
        findMany: async ({ where, orderBy, select }: any) => {
            const db = readDB();
            // Simple filter by userId
            let items = db.items.filter(i => i.userId === where.userId);
            // Ignore orderBy/select for minimal implementation or implement manually if needed
            // (For now, returning full objects is fine, frontend handles it)
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
                lastAccessedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            db.items.push(newItem);
            writeDB(db);
            return newItem;
        },
        update: async ({ where, data }: any) => {
            const db = readDB();
            const index = db.items.findIndex(i => i.id === where.id);
            if (index === -1) throw new Error("Item not found");

            db.items[index] = { ...db.items[index], ...data, updatedAt: new Date() };
            writeDB(db);
            return db.items[index];
        },
        delete: async ({ where }: any) => {
            const db = readDB();
            db.items = db.items.filter(i => i.id !== where.id);
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
            db.auditLogs = db.auditLogs || [];
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
    }
};
