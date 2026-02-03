'use client';

import { useState, useEffect } from 'react';
import { CryptoService } from '@/lib/crypto';
import { Loader2, Plus, LogOut, Copy, RefreshCw, AlertTriangle, Eye, EyeOff, Edit, Trash2, Settings, Wand2, ShieldAlert, CheckCircle, ShieldCheck, KeyRound } from 'lucide-react';
import VerifyModal from './VerifyModal';
import { clsx } from 'clsx';
import { getPasswordStrength } from '@/lib/strength';
import { generateSecurePassword } from '@/lib/generator';
import { checkPasswordBreach } from '@/lib/breach';

interface Props {
    session: any; // { username, token, vaultKey, salt, authHash }
    onLogout: () => void;
    onOpenSettings: () => void;
    onUpdateSession?: (updates: any) => void;
}

interface VaultItem {
    id: string;
    encryptedData: string;
    iv: string;
    updatedAt: string;
    site?: string;
    username?: string;
    password?: string;
    category?: string;
    notes?: string;
    breachCount?: number;
}

export default function VaultDashboard({ session, onLogout, onOpenSettings }: Props) {
    const [items, setItems] = useState<VaultItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');

    // Verification State
    const [showVerify, setShowVerify] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'copy' | 'view' | 'edit', item: VaultItem } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

    // Form State
    const [newSite, setNewSite] = useState('');
    const [newUser, setNewUser] = useState('');
    const [newPass, setNewPass] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [itemBreachCount, setItemBreachCount] = useState<number | null>(null);
    const [error, setError] = useState('');

    const itemStrength = getPasswordStrength(newPass);

    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (newPass && newPass.length > 3) {
                const count = await checkPasswordBreach(newPass);
                setItemBreachCount(count);
            } else {
                setItemBreachCount(null);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [newPass]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vault', {
                headers: { 'Authorization': `Bearer ${session.token}` },
            });
            const data = await res.json();

            const decryptedItems = await Promise.all(data.items.map(async (item: any) => {
                try {
                    const decryptedJson = await CryptoService.decryptData(item.encryptedData, item.iv, session.vaultKey);
                    const content = JSON.parse(decryptedJson);
                    return { ...item, ...content };
                } catch (e) {
                    console.error("Failed to decrypt item", item.id);
                    return { ...item, site: 'ERROR DECRYPTING', username: '---' };
                }
            }));

            setItems(decryptedItems);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const runSecurityScan = async () => {
        setScanning(true);
        const updatedItems = await Promise.all(items.map(async (item) => {
            if (item.password) {
                const count = await checkPasswordBreach(item.password);
                return { ...item, breachCount: count };
            }
            return item;
        }));
        setItems(updatedItems);
        setScanning(false);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Duplicate Check (Site + Username)
        const isDuplicate = items.some(item =>
            item.id !== editingId &&
            item.site?.toLowerCase() === newSite.toLowerCase() &&
            item.username?.toLowerCase() === newUser.toLowerCase()
        );

        if (isDuplicate) {
            setError('An entry for this website and username already exists.');
            return;
        }

        try {
            let finalPass = newPass;
            if (editingId && !newPass) {
                const item = items.find(i => i.id === editingId);
                finalPass = item?.password || '';
            }

            const payload = JSON.stringify({
                site: newSite,
                username: newUser,
                password: finalPass,
                category: newCategory,
                notes: newNotes
            });
            const { encryptedData, iv } = await CryptoService.encryptData(payload, session.vaultKey);

            const url = editingId ? `/api/vault/${editingId}` : '/api/vault';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({ encryptedData, iv }),
            });

            if (!res.ok) throw new Error('Failed to save');

            // Reset
            resetForm();
            fetchItems();
        } catch (e) {
            setError("Failed to save. Please try again.");
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const res = await fetch(`/api/vault/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.token}` },
            });
            if (res.ok) fetchItems();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const onVerified = (masterKey: Uint8Array) => {
        if (!pendingAction) return;

        if (pendingAction.type === 'view') {
            setVisiblePasswords(prev => ({ ...prev, [pendingAction.item.id]: true }));
        } else if (pendingAction.type === 'copy') {
            navigator.clipboard.writeText(pendingAction.item.password || '');
            // In a real app, you'd show a "Copied!" toast
        } else if (pendingAction.type === 'edit') {
            setEditingId(pendingAction.item.id);
            setNewSite(pendingAction.item.site || '');
            setNewUser(pendingAction.item.username || '');
            setNewCategory(pendingAction.item.category || '');
            setNewNotes(pendingAction.item.notes || '');
            setNewPass(''); // Per user request: direct new password option
            setShowModal(true);
        }

        // Log sensitive action
        if (pendingAction.type === 'view' || pendingAction.type === 'copy') {
            fetch('/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: session.username,
                    event: pendingAction.type === 'view' ? 'PASSWORD_VIEWED' : 'PASSWORD_COPIED',
                    metadata: { site: pendingAction.item.site }
                })
            });
        }

        setPendingAction(null);
    };

    const requestVerify = (type: 'view' | 'copy' | 'edit', item: VaultItem) => {
        setPendingAction({ type, item });
        setShowVerify(true);
    };

    const toggleView = (item: VaultItem) => {
        if (visiblePasswords[item.id]) {
            setVisiblePasswords(prev => ({ ...prev, [item.id]: false }));
        } else {
            requestVerify('view', item);
        }
    };

    const resetForm = () => {
        setNewSite('');
        setNewUser('');
        setNewPass('');
        setNewCategory('');
        setNewNotes('');
        setEditingId(null);
        setShowModal(false);
        setError('');
    };

    // Get unique sites and usernames for datalists
    const uniqueSites = Array.from(new Set(items.map(i => i.site).filter(Boolean)));
    const uniqueUsernames = Array.from(new Set(items.map(i => i.username).filter(Boolean)));
    const uniqueCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

    const filteredItems = items.filter(item =>
        item.site?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full max-w-4xl animate-in fade-in">
            <header className="flex justify-between items-center mb-8 p-4 bg-slate-900 rounded-lg border border-slate-800">
                <div>
                    <h1 className="text-xl font-bold text-emerald-400">Secure Vault</h1>
                    <p className="text-xs text-slate-500">Logged in as {session.username}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={runSecurityScan} disabled={scanning} className="p-2 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 rounded flex gap-2 items-center text-sm font-bold transition-all disabled:opacity-50">
                        {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {scanning ? 'Scanning...' : 'Security Scan'}
                    </button>
                    <button onClick={fetchItems} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={onOpenSettings} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors">
                        <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={onLogout} className="p-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded flex gap-2 items-center text-sm font-bold transition-colors">
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </header>

            {/* Security Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                        <KeyRound className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total Items</p>
                        <p className="text-2xl font-bold text-white">{items.length}</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-lg">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Breached</p>
                        <p className="text-2xl font-bold text-white">{items.filter(i => (i.breachCount || 0) > 0).length}</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">2FA Status</p>
                        <p className="text-xs font-bold text-emerald-400">{session.twoFactorEnabled ? 'PROTECTED' : 'NOT ENABLED'}</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 relative">
                <input
                    type="text"
                    placeholder="Search your vault..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-4 pl-12 bg-slate-900 border border-slate-800 rounded-xl focus:border-emerald-500 outline-none text-white transition-all shadow-xl"
                />
                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
            ) : (
                <div className="grid gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-emerald-500/50 transition-all group">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-white text-lg">{item.site}</h3>
                                    {item.category && <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-bold uppercase tracking-wider">{item.category}</span>}
                                    {(item.breachCount || 0) > 0 && (
                                        <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full font-bold flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" /> Compromised ({item.breachCount} leaks)
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-400">{item.username}</p>
                                {item.notes && <p className="text-xs text-slate-600 mt-1 line-clamp-1">{item.notes}</p>}
                            </div>
                            <div className="flex gap-2 items-center">
                                <div className="bg-black/50 px-3 py-1 rounded font-mono text-sm text-slate-300 min-w-[100px] text-center border border-slate-800 opacity-0 group-hover:opacity-100 transition-all">
                                    {visiblePasswords[item.id] ? item.password : '••••••••'}
                                </div>
                                <button onClick={() => toggleView(item)} title={visiblePasswords[item.id] ? "Hide Password" : "View Password"} className="p-2 hover:bg-slate-800 rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                                    {visiblePasswords[item.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button onClick={() => requestVerify('copy', item)} title="Copy Password" className="p-2 hover:bg-slate-800 rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button onClick={() => requestVerify('edit', item)} title="Edit" className="p-2 hover:bg-slate-800 rounded text-blue-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(item.id)} title="Delete" className="p-2 hover:bg-red-900/40 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="text-center text-slate-500 py-12">
                            {searchQuery ? 'No matching secrets found.' : 'No secrets yet. Add one!'}
                        </div>
                    )}
                </div>
            )}

            {/* FAB to Add */}
            <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform hover:scale-105"
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <form onSubmit={handleSaveItem} autoCorrect="off" autoComplete="off" className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-full max-w-lg space-y-4 shadow-2xl animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold text-white mb-2">{editingId ? 'Edit Secret' : 'Add New Secret'}</h3>

                        {error && (
                            <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Website / Service</label>
                                <input
                                    list="site-list"
                                    value={newSite}
                                    onChange={e => setNewSite(e.target.value)}
                                    placeholder="e.g. Gmail, Netflix..."
                                    className="w-full p-3 bg-black border border-slate-700 rounded text-white focus:border-emerald-500 outline-none transition-colors"
                                    required
                                    autoComplete="off"
                                />
                                <datalist id="site-list">
                                    {uniqueSites.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                <input
                                    list="category-list"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="e.g. Work, Social..."
                                    className="w-full p-3 bg-black border border-slate-700 rounded text-white focus:border-emerald-500 outline-none transition-colors"
                                    autoComplete="off"
                                />
                                <datalist id="category-list">
                                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username / Email</label>
                                <input
                                    list="user-list"
                                    value={newUser}
                                    onChange={e => setNewUser(e.target.value)}
                                    placeholder="e.g. user@example.com"
                                    className="w-full p-3 bg-black border border-slate-700 rounded text-white focus:border-emerald-500 outline-none transition-colors"
                                    required
                                    autoComplete="off"
                                />
                                <datalist id="user-list">
                                    {uniqueUsernames.map(u => <option key={u} value={u} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                                    {editingId ? 'New Password' : 'Password'}
                                    <button
                                        type="button"
                                        onClick={async () => setNewPass(await generateSecurePassword(24))}
                                        className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 normal-case"
                                    >
                                        <Wand2 className="w-3 h-3" /> Generate
                                    </button>
                                </label>
                                <div className="relative">
                                    <input
                                        value={newPass}
                                        onChange={e => setNewPass(e.target.value)}
                                        placeholder={editingId ? "Leave empty for NO change" : "Secret Password"}
                                        type="text"
                                        className="w-full p-3 bg-black border border-slate-700 rounded text-white font-mono focus:border-emerald-500 outline-none transition-colors"
                                        required={!editingId}
                                        autoComplete="new-password"
                                    />
                                    {newPass && (
                                        <button
                                            type="button"
                                            onClick={async () => setNewPass(await generateSecurePassword(24))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-emerald-500 transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {newPass && (
                                    <div className="mt-2 space-y-1">
                                        <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-tighter">
                                            <span className="text-slate-500">Strength</span>
                                            <span className={itemStrength.color.replace('bg-', 'text-')}>{itemStrength.label}</span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={clsx("h-full transition-all duration-500", itemStrength.color)}
                                                style={{ width: `${(itemStrength.score + 1) * 16.6}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {itemBreachCount !== null && (
                                    <div className={clsx(
                                        "mt-2 p-2 rounded flex items-center gap-2 text-[10px] font-bold uppercase",
                                        itemBreachCount > 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    )}>
                                        {itemBreachCount > 0 ? (
                                            <><ShieldAlert className="w-3 h-3" /> Compromised in {itemBreachCount} data breaches! Change immediately.</>
                                        ) : (
                                            <><CheckCircle className="w-3 h-3" /> No known breaches found for this password.</>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                            <textarea
                                value={newNotes}
                                onChange={e => setNewNotes(e.target.value)}
                                placeholder="Additional details, security questions, etc."
                                className="w-full p-3 bg-black border border-slate-700 rounded text-white focus:border-emerald-500 outline-none transition-colors h-24 resize-none"
                                autoComplete="off"
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={resetForm} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold transition-colors shadow-lg shadow-emerald-900/20">
                                {editingId ? 'Update secret' : 'Save Secret'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Verification Modal */}
            <VerifyModal
                isOpen={showVerify}
                onClose={() => { setShowVerify(false); setPendingAction(null); }}
                onVerified={onVerified}
                userSalt={session.salt}
                expectedAuthHash={session.authHash}
            />
        </div>
    );
}
