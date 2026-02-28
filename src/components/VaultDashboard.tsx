'use client';

import { useState, useEffect, useMemo } from 'react';
import { CryptoService } from '@/lib/crypto';
import {
    Loader2, Plus, Lock, Globe, Eye, EyeOff, Copy, Trash2, Edit,
    LogOut, Settings, User, ShieldCheck, ShieldAlert, RefreshCw,
    Check, X, Download, ChevronRight, Search, LayoutGrid, List,
    History, Clock, RotateCcw, Zap, Menu, Landmark, CreditCard
} from 'lucide-react';
import VerifyModal from './VerifyModal';
import { clsx } from 'clsx';
import { generateSecurePassword } from '@/lib/generator';
import { getPasswordStrength } from '@/lib/strength';
import { motion, AnimatePresence } from 'framer-motion';
import CyberButton from './ui/CyberButton';
import { showToast } from './ui/Toast';

interface Props {
    session: any;
    onLogout: () => void;
    onOpenSettings: () => void;
}

export default function VaultDashboard({ session, onLogout, onOpenSettings }: Props) {
    const [items, setItems] = useState<any[]>([]);
    const [vaults, setVaults] = useState<any[]>([]);
    const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAddVaultModal, setShowAddVaultModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [newVaultName, setNewVaultName] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showHistoryItem, setShowHistoryItem] = useState<any | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Form state
    const [site, setSite] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [category, setCategory] = useState('General');
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState('');
    const [recordType, setRecordType] = useState<'LOGIN' | 'BANK' | 'CARD'>('LOGIN');

    // Bank Specific
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [iban, setIban] = useState('');
    const [swift, setSwift] = useState('');

    // Card Specific
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [pin, setPin] = useState('');
    const [showFormPassword, setShowFormPassword] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [policyRequireAuth, setPolicyRequireAuth] = useState(false);
    const [policyTimeLock, setPolicyTimeLock] = useState(false);
    const [policyTimeStart, setPolicyTimeStart] = useState('09:00');
    const [policyTimeEnd, setPolicyTimeEnd] = useState('17:00');
    const [policyAutoWipe, setPolicyAutoWipe] = useState(false);
    const [policyLockedUntil, setPolicyLockedUntil] = useState('');
    const [isHoneyToken, setIsHoneyToken] = useState(false);
    const [heartbeat, setHeartbeat] = useState(0);

    const strength = getPasswordStrength(password);

    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        const q = searchQuery.toLowerCase().trim();
        return items.filter(item => {
            const siteMatch = item.site?.toLowerCase().includes(q);
            const tagMatch = item.tags?.toLowerCase().split(',').some((t: string) => t.trim().includes(q));
            const userMatch = item.username?.toLowerCase().includes(q);
            const categoryMatch = item.category?.toLowerCase().includes(q);
            return siteMatch || tagMatch || userMatch || categoryMatch;
        });
    }, [items, searchQuery]);

    useEffect(() => {
        fetchVaults();
        const interval = setInterval(() => setHeartbeat(h => h + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (activeVaultId || vaults.length > 0) {
            fetchItems();
        }
    }, [activeVaultId, vaults]);

    useEffect(() => {
        if (heartbeat > 0) {
            // Periodic Security Check
            fetch('/api/auth/status', {
                headers: { 'Authorization': `Bearer ${session.token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.isLockedDown) {
                        CryptoService.setLockdown(true);
                    }
                })
                .catch(err => console.error('Security heartbeat failure:', err));
        }
    }, [heartbeat]);

    const fetchVaults = async () => {
        try {
            const res = await fetch('/api/vaults', {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const data = await res.json();
            const vaultsList = data.vaults || [];
            setVaults(vaultsList);
            if (vaultsList.length > 0 && !activeVaultId) {
                setActiveVaultId(vaultsList[0].id);
            }
        } catch (err) {
            showToast('Intelligence failure: Could not retrieve vault structures.', 'error');
            console.error('Failed to fetch vaults', err);
            setVaults([]);
        }
    };

    const reportThreat = async (event: string, details: any = {}, severity = 1) => {
        try {
            const res = await fetch('/api/threat/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({ event, details, severity })
            });
            const data = await res.json();
            if (data.isLockedDown) {
                CryptoService.setLockdown(true);
            }
        } catch (err) {
            console.error('Failed to report threat:', err);
        }
    };

    const fetchItems = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const url = activeVaultId ? `/api/items?vaultId=${activeVaultId}` : '/api/items';
            const res = await fetch(`/api/vault?vaultId=${activeVaultId}`, {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const data = await res.json();
            const itemsList = data.items || [];

            // Decrypt items
            const decryptedItems = await Promise.all(itemsList.map(async (item: any) => {
                try {
                    const vault = (vaults || []).find(v => v.id === item.vaultId);
                    if (!vault) throw new Error('Vault not found');
                    // Format for decryptKey is nonce:ciphertext
                    const subKey = await CryptoService.decryptKey(`${vault.iv}:${vault.encryptedSubKey}`, session.vaultKey);
                    const decryptedData = await CryptoService.decryptData(item.encryptedData, item.iv, subKey);
                    const bundle = JSON.parse(decryptedData);

                    return {
                        ...item,
                        ...bundle,
                        // Ensure password is explicitly available for the UI
                        password: bundle.password
                    };
                } catch (e) {
                    // If it's old data (not JSON), fallback to legacy display
                    try {
                        const vault = (vaults || []).find(v => v.id === item.vaultId);
                        if (!vault) throw new Error('Vault not found');
                        const subKey = await CryptoService.decryptKey(`${vault.iv}:${vault.encryptedSubKey}`, session.vaultKey);
                        const decryptedPassword = await CryptoService.decryptData(item.encryptedData, item.iv, subKey);
                        return { ...item, password: decryptedPassword, site: item.site || 'Legacy Record', username: item.username || 'Unknown' };
                    } catch (e2) {
                        return { ...item, password: '[Decryption Error]', site: 'Error', username: 'Error' };
                    }
                }
            }));

            setItems(decryptedItems);
            setSelectedIds(new Set()); // Reset selection on refresh
        } catch (err) {
            showToast('Decryption anomaly: Unauthorized access or data corruption detected.', 'error');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVault = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const subKey = CryptoService.generateVaultKey();
            const encryptedPackage = await CryptoService.encryptKey(subKey, session.vaultKey);
            const [iv, encryptedSubKey] = encryptedPackage.split(':');

            // UNIQUENESS CHECK: Ensure no duplicate vault name
            const normalizedVaultName = newVaultName.trim().toLowerCase();
            const isVaultDuplicate = (vaults || []).some(v => v.name.trim().toLowerCase() === normalizedVaultName);
            if (isVaultDuplicate) {
                showToast(`A vault named "${newVaultName}" already exists.`, 'error');
                return;
            }

            const res = await fetch('/api/vaults', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    name: newVaultName,
                    icon: 'Lock',
                    encryptedSubKey,
                    iv
                }),
            });

            if (res.ok) {
                const data = await res.json();
                const newVault = data.vault;
                if (newVault) {
                    setVaults([...vaults, newVault]);
                    setActiveVaultId(newVault.id);
                    setNewVaultName('');
                    setShowAddVaultModal(false);
                    showToast(`Vault "${newVault.name}" established in Cryptosphere.`, 'success');
                }
            } else {
                showToast('Vault creation refused by server.', 'error');
            }
        } catch (err) {
            showToast('Protocol failure during vault creation.', 'error');
            console.error(err);
        }
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const targetVaultId = activeVaultId || (vaults && vaults[0]?.id);
            const vault = (vaults || []).find(v => v.id === targetVaultId);
            if (!vault) throw new Error('No target vault found');

            const subKey = await CryptoService.decryptKey(`${vault.iv}:${vault.encryptedSubKey}`, session.vaultKey);

            // UNIQUENESS CHECK: Ensure no duplicate site + username in the same vault
            const normalizedSite = site.trim().toLowerCase();
            const normalizedUser = username.trim().toLowerCase();

            const isDuplicate = items.some(item =>
                item.id !== editingItem?.id &&
                item.site.trim().toLowerCase() === normalizedSite &&
                item.username.trim().toLowerCase() === normalizedUser
            );

            if (isDuplicate) {
                const errorMsg = `A record for "${site}" with username "${username}" already exists in this vault.`;
                setFormError(errorMsg);
                showToast(errorMsg, 'error');
                setLoading(false);
                return;
            }

            setFormError(null);

            // BUNDLING: Wrap all metadata into the encrypted blob for full zero-knowledge
            // For versioning, we carry over the previous history if editing
            const previousHistory = editingItem?.history || [];

            // Create a snapshot of the CURRENT state before save (if editing)
            const historyEntry = editingItem ? {
                site: editingItem.site,
                username: editingItem.username,
                password: editingItem.password,
                category: editingItem.category,
                notes: editingItem.notes,
                versionDate: editingItem.updatedAt || new Date().toISOString()
            } : null;

            // Bundle all metadata for zero-knowledge storage
            const bundle: any = {
                site,
                username,
                password,
                category, // Keep category for now, might be removed later if fully dynamic
                notes,
                tags,
                recordType,
                // Bank fields
                bankName,
                accountNumber,
                iban,
                swift,
                // Card fields
                cardNumber,
                cardExpiry,
                cvv,
                pin,
                policy: {
                    requireAuth: policyRequireAuth,
                    timeLock: policyTimeLock ? { start: policyTimeStart, end: policyTimeEnd } : null,
                    autoWipe: policyAutoWipe,
                    lockedUntil: policyLockedUntil
                },
                updatedAt: new Date().toISOString(),
                history: historyEntry ? [historyEntry, ...previousHistory].slice(0, 10) : previousHistory // Keep last 10 versions
            };

            const [{ encryptedData, iv }, blindIndex] = await Promise.all([
                CryptoService.encryptData(JSON.stringify(bundle), subKey),
                CryptoService.generateBlindIndex(site, session.vaultKey) // Use vaultKey as the KDF root
            ]);

            const url = editingItem ? `/api/vault/${editingItem.id}` : '/api/vault';
            const res = await fetch(url, {
                method: editingItem ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    encryptedData,
                    iv,
                    vaultId: targetVaultId,
                    blindIndex, // Send the searchable (but secured) index
                    isHoneyToken // Flag as decoy
                }),
            });

            if (res.ok) {
                await fetchItems(true); // Silent refresh for instant field updates
                setShowAddModal(false);
                setEditingItem(null);
                resetForm();
                showToast(`Secret for "${site}" successfully committed.`, 'success');
            } else {
                const error = await res.json();
                showToast(error.message || 'Server rejected the commit protocol.', 'error');
            }
        } catch (err: any) {
            const message = err.message || 'Unknown cryptographic interference.';
            showToast(`Commit failure: ${message}`, 'error');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Are you sure you want to delete this secret?')) return;
        try {
            await fetch(`/api/vault/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            showToast('Secret purged from Cryptosphere.', 'success');
            fetchItems(true);
        } catch (err) {
            showToast('Purge protocol failed.', 'error');
            console.error(err);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected items?`)) return;
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id =>
                fetch(`/api/vault/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${session.token}` }
                })
            ));
            showToast(`${selectedIds.size} records successfully purged.`, 'success');
            fetchItems(true);
        } catch (err) {
            showToast('Bulk purge protocol interrupted.', 'error');
            console.error('Bulk delete failed', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkExport = () => {
        try {
            const selectedItems = items.filter(i => selectedIds.has(i.id));
            const exportData = JSON.stringify(selectedItems, null, 2);
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `axiom-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`${selectedItems.length} records exfiltrated to local storage.`, 'success');
        } catch (err) {
            showToast('Exfiltration failure.', 'error');
        }
    };

    const resetForm = () => {
        setSite('');
        setUsername('');
        setPassword('');
        setCategory('General');
        setNotes('');
        setTags('');
        setEditingItem(null);
        setFormError(null);
        setShowFormPassword(false);
        setPolicyRequireAuth(false);
        setPolicyTimeLock(false);
        setPolicyAutoWipe(false);
        setPolicyLockedUntil('');
        setIsHoneyToken(false);
        setRecordType('LOGIN');
        setBankName('');
        setAccountNumber('');
        setIban('');
        setSwift('');
        setCardNumber('');
        setCardExpiry('');
        setCvv('');
        setPin('');
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setSite(item.site);
        setUsername(item.username || '');
        setPassword(item.password || '');
        setCategory(item.category || 'General');
        setNotes(item.notes || '');
        setTags(item.tags || '');
        setPolicyRequireAuth(item.policy?.requireAuth || false);
        setPolicyTimeLock(!!item.policy?.timeLock);
        setPolicyTimeStart(item.policy?.timeLock?.start || '09:00');
        setPolicyTimeEnd(item.policy?.timeLock?.end || '17:00');
        setPolicyAutoWipe(item.policy?.autoWipe || false);
        setPolicyLockedUntil(item.policy?.lockedUntil || '');
        setIsHoneyToken(!!item.isHoneyToken);

        // Specialized types
        setRecordType(item.recordType || 'LOGIN');
        setBankName(item.bankName || '');
        setAccountNumber(item.accountNumber || '');
        setIban(item.iban || '');
        setSwift(item.swift || '');
        setCardNumber(item.cardNumber || '');
        setCardExpiry(item.cardExpiry || '');
        setCvv(item.cvv || '');
        setPin(item.pin || '');

        setShowAddModal(true);
    };

    const handleRestoreVersion = (version: any) => {
        setSite(version.site);
        setUsername(version.username);
        setPassword(version.password);
        setCategory(version.category || 'General');
        setNotes(version.notes || '');
        setShowHistoryItem(null);
        setShowAddModal(true);
        // We keep the editingItem as the original one so handleSaveItem knows it's an update
        showToast('Historical snapshot loaded into terminal. Verify and commit to restore.', 'info');
    };

    const checkPolicyAccess = (item: any, action: 'view' | 'copy') => {
        const nowEpoch = Date.now();

        // 1. FUTURE UNLOCK CHECK (One-time)
        if (item.policy?.lockedUntil) {
            const unlockEpoch = new Date(item.policy.lockedUntil).getTime();

            if (!isNaN(unlockEpoch) && nowEpoch < unlockEpoch) {
                const diff = unlockEpoch - nowEpoch;
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.max(1, Math.round((diff % (1000 * 60 * 60)) / (1000 * 60)));

                let timeMsg = `${mins}m`;
                if (hours > 0) timeMsg = `${hours}h ${mins}m`;
                if (hours > 24) timeMsg = `${Math.floor(hours / 24)}d`;

                showToast(`TEMPORAL LOCK: Available in ${timeMsg}.`, 'error');
                return false;
            }
        }

        // 2. TIME LOCK CHECK (Daily Window)
        if (item.policy?.timeLock) {
            const now = new Date();
            const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const { start, end } = item.policy.timeLock;

            if (currentTimeStr < start || currentTimeStr > end) {
                showToast(`ACCESS DENIED: Window inactive (${start} - ${end}).`, 'error');
                return false;
            }
        }
        return true;
    };

    const handleView = (item: any) => {
        if (!checkPolicyAccess(item, 'view')) return;

        // 🛡️ Honey-token Detection
        if (item.isHoneyToken) {
            reportThreat('HONEY_TOKEN_VIEW', { itemId: item.id, site: item.site }, 1);
        }

        return true; // Used by VerifyModal to proceed
    };

    const handleCopy = (item: any) => {
        if (!checkPolicyAccess(item, 'copy')) return;

        // 🛡️ Honey-token Detection
        if (item.isHoneyToken) {
            reportThreat('HONEY_TOKEN_EXFILTRATION', { itemId: item.id, site: item.site }, 2);
            // We still "succeed" visually but return junk if lockdown triggered
        }

        navigator.clipboard.writeText(item.password);
        showToast('Sequence exfiltrated to clipboard.', 'success');

        if (item.policy?.autoWipe) {
            showToast('Zero-Trace active: Clipboard wipe in 30s.', 'info');
            setTimeout(() => {
                navigator.clipboard.writeText('');
                showToast('Clipboard sanitized (Zero-Trace Policy).', 'info');
            }, 30000);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const activeVault = (vaults || []).find(v => v.id === activeVaultId);

    return (
        <div className="flex flex-col md:flex-row h-screen md:h-[calc(100vh-4rem)] w-full max-w-[1600px] mx-auto glass md:rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl relative">

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between p-4 bg-black/40 border-b border-white/5 backdrop-blur-md z-30">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 bg-slate-900 rounded-lg text-slate-400"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-black text-white tracking-widest uppercase">Axiom</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowAddModal(true)} className="p-2 bg-blue-500 rounded-lg text-white">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Sidebar Overlay (Mobile) */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            className="fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-white/10 z-50 p-6 flex flex-col md:hidden"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <span className="font-black text-sm tracking-widest text-white uppercase italic">Cryptosphere Domains</span>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2">
                                {(vaults || []).map((vault) => (
                                    <button
                                        key={vault.id}
                                        onClick={() => { setActiveVaultId(vault.id); setIsMobileMenuOpen(false); }}
                                        className={clsx(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                                            activeVaultId === vault.id ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:bg-white/5"
                                        )}
                                    >
                                        <div className={clsx(
                                            "w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs",
                                            activeVaultId === vault.id ? "bg-blue-500/20" : "bg-slate-900"
                                        )}>
                                            {vault.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[12px] font-black uppercase tracking-widest">{vault.name}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-white/5 mt-auto">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800">
                                        <User className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <span className="font-black text-xs text-white uppercase tracking-wider">{session.username}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { onOpenSettings(); setIsMobileMenuOpen(false); }} className="flex-1 py-3 bg-slate-900 rounded-xl text-slate-400 flex justify-center uppercase text-[10px] font-black tracking-widest">Settings</button>
                                    <button onClick={onLogout} className="px-4 py-3 bg-red-500/10 rounded-xl text-red-500 flex justify-center uppercase text-[10px] font-black tracking-widest">Exit</button>
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex w-64 border-r border-white/5 flex-col bg-black/20">
                <div className="p-5 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <Lock className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="font-black text-xs tracking-[0.2em] text-white uppercase">Vault Domains</span>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                    {(vaults || []).map((vault) => (
                        <button
                            key={vault.id}
                            onClick={() => setActiveVaultId(vault.id)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                                activeVaultId === vault.id
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                            )}
                        >
                            {activeVaultId === vault.id && (
                                <motion.div
                                    layoutId="vault-active"
                                    className="absolute left-0 w-1 h-4 bg-blue-500 rounded-full"
                                />
                            )}
                            <div className={clsx(
                                "w-6 h-6 rounded flex items-center justify-center transition-colors font-black text-[10px]",
                                activeVaultId === vault.id ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                            )}>
                                {vault.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest truncate">{vault.name}</span>
                        </button>
                    ))}

                    <button
                        onClick={() => setShowAddVaultModal(true)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-blue-400 hover:bg-blue-500/5 rounded-xl transition-all group mt-4 border border-dashed border-slate-800 hover:border-blue-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">New Domain</span>
                    </button>
                </div>

                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                            <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white uppercase tracking-tight truncate w-24">{session.username}</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Identity Verified</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onOpenSettings} className="flex-1 p-2 bg-slate-900/50 hover:bg-slate-800 rounded-lg text-slate-400 flex justify-center transition-colors">
                            <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={onLogout} className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg text-red-500 flex justify-center transition-all">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-black/[0.02]">
                <header className="h-20 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-black/40 md:bg-black/20 gap-3">
                    <div className="hidden md:flex items-center gap-3">
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">{activeVault?.name || 'Axiom Vault'}</h2>
                        <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-black text-blue-500 uppercase tracking-widest">
                            {items.length} Records
                        </div>
                    </div>

                    <div className="flex-1 md:max-w-md relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="w-3.5 h-3.5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="SEARCH ENCRYPTED DOMAIN..."
                            className="w-full bg-black/40 border border-slate-800/50 rounded-xl py-2.5 md:py-2 pl-9 pr-4 text-[10px] font-black text-white placeholder:text-slate-700 focus:border-blue-500/50 focus:outline-none transition-all"
                        />
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        {items.length > 0 && (
                            <button
                                onClick={toggleSelectAll}
                                className="text-[10px] font-black text-slate-500 hover:text-blue-500 border border-transparent hover:border-slate-800 uppercase tracking-widest px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
                            >
                                {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        <CyberButton
                            onClick={() => { resetForm(); setShowAddModal(true); }}
                            className="h-9 px-4 text-[10px] uppercase tracking-widest"
                        >
                            <Plus className="w-3 h-3" /> Add Secret
                        </CyberButton>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Decrypting Secure Store</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-20 h-20 bg-slate-900/30 rounded-3xl flex items-center justify-center mb-6 border border-slate-800">
                                <ShieldAlert className="w-10 h-10 text-slate-700" />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Vault Empty</h3>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-tight max-w-xs leading-relaxed">
                                This cryptographic domain currently contains no indexed secrets.
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 bg-slate-900/30 rounded-2xl flex items-center justify-center mb-4 border border-slate-800">
                                <Search className="w-8 h-8 text-slate-700" />
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">No Matches</h3>
                            <p className="text-slate-600 text-[10px] uppercase font-bold tracking-tight">Zero records found for "{searchQuery}"</p>
                            <button onClick={() => setSearchQuery('')} className="mt-4 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">Reset Filter</button>
                        </div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-7 pb-24"
                        >
                            {filteredItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    variants={itemVariants}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('button')) return;
                                        toggleSelect(item.id);
                                    }}
                                    className={clsx(
                                        "group relative bg-black/40 border rounded-3xl p-4 md:p-5 transition-all cursor-pointer",
                                        selectedIds.has(item.id)
                                            ? "border-blue-500 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                                            : "border-slate-800/50 hover:border-blue-500/30 hover:bg-blue-500/[0.02]"
                                    )}
                                >
                                    {/* Selection Indicator */}
                                    <div className={clsx(
                                        "absolute top-4 right-4 w-4 h-4 rounded border transition-all flex items-center justify-center",
                                        selectedIds.has(item.id)
                                            ? "bg-blue-500 border-blue-500"
                                            : "border-slate-700 bg-slate-900 opacity-0 group-hover:opacity-100"
                                    )}>
                                        {selectedIds.has(item.id) && <Check className="w-3 h-3 text-white" />}
                                    </div>

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
                                                selectedIds.has(item.id) ? "bg-blue-500/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-slate-900 border-slate-800 group-hover:border-blue-500/30"
                                            )}>
                                                {item.recordType === 'BANK' ? (
                                                    <Landmark className={clsx("w-5 h-5 transition-colors", selectedIds.has(item.id) ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400")} />
                                                ) : item.recordType === 'CARD' ? (
                                                    <CreditCard className={clsx("w-5 h-5 transition-colors", selectedIds.has(item.id) ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400")} />
                                                ) : (
                                                    <Globe className={clsx("w-5 h-5 transition-colors", selectedIds.has(item.id) ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400")} />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0 pr-6">
                                                <span className="text-[13px] font-black text-white uppercase tracking-wider truncate mb-0.5">{item.site}</span>
                                                <span className="text-[10px] font-bold text-slate-500 truncate tracking-tight">
                                                    {item.recordType === 'LOGIN' ? item.username :
                                                        item.recordType === 'BANK' ? (item.iban || item.accountNumber || item.username) :
                                                            item.recordType === 'CARD' ? (item.cardNumber ? `•••• ${item.cardNumber.slice(-4)}` : item.username) :
                                                                item.username}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {item.category && (
                                            <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-md text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                                                {item.category}
                                            </span>
                                        )}

                                        {item.policy?.requireAuth && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md" title="Mandatory Re-auth Active">
                                                <ShieldCheck className="w-2.5 h-2.5 text-blue-400" />
                                                <span className="text-[7px] font-black text-blue-400 uppercase tracking-tighter">RE-AUTH</span>
                                            </div>
                                        )}

                                        {item.policy?.timeLock && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md" title={`Time-Lock Active: ${item.policy.timeLock.start} - ${item.policy.timeLock.end}`}>
                                                <Clock className="w-2.5 h-2.5 text-amber-500" />
                                                <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter">LOCKED</span>
                                            </div>
                                        )}

                                        {item.policy?.autoWipe && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md" title="Zero-Trace Auto-Wipe Active">
                                                <Zap className="w-2.5 h-2.5 text-emerald-500" />
                                                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">WIPE</span>
                                            </div>
                                        )}

                                        {item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime() && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-md" title={`Locked Until: ${new Date(item.policy.lockedUntil).toLocaleString()}`}>
                                                <Lock className="w-2.5 h-2.5 text-rose-500" />
                                                <span className="text-[7px] font-black text-rose-500 uppercase tracking-tighter">LOCKED UNTIL {new Date(item.policy.lockedUntil).toLocaleString()}</span>
                                            </div>
                                        )}

                                        {item.tags && item.tags.split(',').map((tag: string, idx: number) => (
                                            <span key={idx} className="px-2 py-0.5 bg-blue-500/5 border border-blue-500/10 rounded-md text-[7px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">
                                                {tag.trim()}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <VerifyModal
                                                actionLabel="Unlock"
                                                userSalt={session.salt}
                                                forceVerify={item.policy?.requireAuth}
                                                onVerified={() => {
                                                    if (checkPolicyAccess(item, 'view')) {
                                                        if (item.recordType === 'BANK') {
                                                            showToast(`Access Key for ${item.site}: ${item.password || 'None Set'}`, 'info');
                                                        } else if (item.recordType === 'CARD') {
                                                            showToast(`ATM PIN for ${item.site}: ${item.pin || 'None Set'}`, 'info');
                                                        } else {
                                                            showToast(`Sequence for ${item.site}: ${item.password}`, 'info');
                                                        }
                                                    }
                                                }}
                                                session={session}
                                            >
                                                <button
                                                    disabled={item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime()}
                                                    className={clsx(
                                                        "w-full flex items-center justify-center gap-2 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                                        (item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime())
                                                            ? "bg-slate-900/20 border-slate-900 text-slate-700 cursor-not-allowed opacity-50"
                                                            : "bg-slate-900/50 hover:bg-blue-500/10 border-slate-800 hover:border-blue-500/20 text-slate-400 hover:text-blue-400"
                                                    )}
                                                >
                                                    {item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime() ? <Lock className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    {item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime() ? 'Locked' : 'View'}
                                                </button>
                                            </VerifyModal>
                                        </div>

                                        <div className="flex-1">
                                            <VerifyModal
                                                actionLabel="Exfiltrate"
                                                userSalt={session.salt}
                                                forceVerify={item.policy?.requireAuth}
                                                onVerified={() => handleCopy(item)}
                                                session={session}
                                            >
                                                <button
                                                    disabled={item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime()}
                                                    className={clsx(
                                                        "w-full flex items-center justify-center gap-2 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                                        (item.policy?.lockedUntil && Date.now() < new Date(item.policy.lockedUntil).getTime())
                                                            ? "bg-slate-900/20 border-slate-900 text-slate-700 cursor-not-allowed opacity-50"
                                                            : "bg-slate-900/50 hover:bg-emerald-500/10 border-slate-800 hover:border-emerald-500/20 text-slate-400 hover:text-emerald-400"
                                                    )}
                                                >
                                                    <Copy className="w-3 h-3" /> Copy
                                                </button>
                                            </VerifyModal>
                                        </div>

                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowHistoryItem(item); }}
                                                className="p-2 text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                title="View History"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-2 text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all">
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>

                {/* Bulk Action Bar */}
                <AnimatePresence>
                    {selectedIds.size > 0 && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
                        >
                            <div className="bg-slate-950/95 backdrop-blur-2xl border border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.15)] rounded-3xl px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center gap-3 md:gap-6 w-[calc(100vw-2rem)] md:w-auto">
                                <div className="flex items-center gap-3 w-full md:w-auto border-b md:border-b-0 border-white/5 pb-2 md:pb-0">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{selectedIds.size} Selected</span>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Bulk Operations Active</span>
                                    </div>
                                    <div className="md:hidden ml-auto">
                                        <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-500 hover:text-white transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="hidden md:block h-8 w-px bg-slate-800" />

                                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                                    <button
                                        onClick={handleBulkExport}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-[9px] font-black text-slate-300 hover:text-blue-400 uppercase tracking-widest transition-all"
                                    >
                                        <Download className="w-3.5 h-3.5" /> <span className="md:inline">Export</span>
                                    </button>

                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black text-red-500 uppercase tracking-widest transition-all group"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 group-hover:animate-bounce" /> <span className="md:inline">Wipe</span>
                                    </button>

                                    <button
                                        onClick={() => setSelectedIds(new Set())}
                                        className="hidden md:flex p-2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Modal Components */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowAddModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-950 border border-slate-800 p-6 rounded-3xl w-full max-w-lg relative z-10 shadow-2xl space-y-4 max-h-[calc(100vh-3rem)] flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                                <h3 className="text-lg font-black text-white uppercase tracking-widest">
                                    {editingItem ? 'Index Override' : 'New Cryptographic Entry'}
                                </h3>
                                <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-1.5">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Secure Form</span>
                                </div>
                            </div>

                            <form onSubmit={handleSaveItem} className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto px-1 space-y-4 mb-4 scrollbar-thin scrollbar-thumb-slate-800">
                                    {/* Record Type Selector */}
                                    <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-slate-800">
                                        {(['LOGIN', 'BANK', 'CARD'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setRecordType(type)}
                                                className={clsx(
                                                    "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                    recordType === type ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                                {recordType === 'LOGIN' ? 'Domain / Site' : recordType === 'BANK' ? 'Bank / Institution' : 'Card Provider'}
                                            </label>
                                            <input value={site} onChange={(e) => setSite(e.target.value)} list="site-suggestions" className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-bold transition-all" placeholder={recordType === 'LOGIN' ? "e.g. ProtonMail" : recordType === 'BANK' ? "e.g. Chase Bank" : "e.g. Visa Platinum"} required />
                                            {recordType === 'LOGIN' && (
                                                <datalist id="site-suggestions">
                                                    <option value="Google" /><option value="Microsoft" /><option value="GitHub" /><option value="Amazon" /><option value="Apple" /><option value="Netflix" /><option value="Spotify" />
                                                </datalist>
                                            )}
                                        </div>
                                    </div>

                                    {recordType === 'LOGIN' && (
                                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Verified Identity (Username/Email)</label>
                                                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-bold transition-all" placeholder="operator@domain.com" required />
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-1.5 px-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Secret Sequence</label>
                                                    <button type="button" onClick={async () => setPassword(await generateSecurePassword(24))} className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-1 transition-colors">
                                                        <RefreshCw className="w-2.5 h-2.5" /> High-Entropy Gen
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <input type={showFormPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="••••••••••••" required />
                                                    <button type="button" onClick={() => setShowFormPassword(!showFormPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-blue-500">
                                                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {recordType === 'BANK' && (
                                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Account Holder Name</label>
                                                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-bold transition-all" placeholder="Full Name" required />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Account Number</label>
                                                    <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="0000000000" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">IBAN</label>
                                                    <input value={iban} onChange={(e) => setIban(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="GB00..." />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Swift / BIC</label>
                                                <input value={swift} onChange={(e) => setSwift(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="BIC CODE" />
                                            </div>
                                            <div className="relative">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Online Access Secret</label>
                                                <input type={showFormPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="Web Portal Password" />
                                                <button type="button" onClick={() => setShowFormPassword(!showFormPassword)} className="absolute right-3 top-[calc(100%-1.6rem)] text-slate-600 hover:text-blue-500">
                                                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {recordType === 'CARD' && (
                                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Cardholder Name</label>
                                                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-bold transition-all" placeholder="Full Name" required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Card Number</label>
                                                <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())} maxLength={19} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="0000 0000 0000 0000" />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Expiry (MM/YY)</label>
                                                    <input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="MM/YY" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">CVV</label>
                                                    <input value={cvv} onChange={(e) => setCvv(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="000" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">ATM / Physical PIN</label>
                                                <input type={showFormPassword ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-mono transition-all" placeholder="0000" />
                                            </div>
                                        </motion.div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Security Notes (Optional)</label>
                                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-bold transition-all h-16 resize-none" placeholder="Contextual details..." />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5 px-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Cryptographic Tags</label>
                                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Comma Separated</span>
                                        </div>
                                        <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full p-3 bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500/50 outline-none text-white text-xs font-bold transition-all" placeholder="Work, Dev, Admin" />
                                    </div>

                                    <div className="space-y-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">High-Assurance Policies</span>
                                            </div>
                                            <span className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter italic">Client-Side Enforcement</span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 pt-1">
                                            <label className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                                <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-tight">Mandatory Re-authentication</span>
                                                <input type="checkbox" checked={policyRequireAuth} onChange={(e) => setPolicyRequireAuth(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50" />
                                            </label>

                                            <div className="space-y-2">
                                                <label className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-tight">Daily Access Window (Periodic Release)</span>
                                                    <input type="checkbox" checked={policyTimeLock} onChange={(e) => setPolicyTimeLock(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50" />
                                                </label>

                                                <label className="flex items-center justify-between p-2 hover:bg-red-500/5 rounded-lg cursor-pointer transition-colors group">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-red-500/70 group-hover:text-red-400 uppercase tracking-tight">Active Decoy (Honey-Token)</span>
                                                        <span className="text-[7px] font-bold text-slate-600 uppercase tracking-tighter">Silent Alarm Triggered on Access</span>
                                                    </div>
                                                    <input type="checkbox" checked={isHoneyToken} onChange={(e) => setIsHoneyToken(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-red-500 focus:ring-red-500/50" />
                                                </label>

                                                {policyTimeLock && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="flex items-center gap-2 px-2 pb-1"
                                                    >
                                                        <input type="time" value={policyTimeStart} onChange={(e) => setPolicyTimeStart(e.target.value)} className="bg-black/60 border border-slate-800 rounded-md p-1 text-[9px] font-black text-blue-400 outline-none" />
                                                        <span className="text-slate-600 text-[8px] font-black uppercase">To</span>
                                                        <input type="time" value={policyTimeEnd} onChange={(e) => setPolicyTimeEnd(e.target.value)} className="bg-black/60 border border-slate-800 rounded-md p-1 text-[9px] font-black text-blue-400 outline-none" />
                                                    </motion.div>
                                                )}
                                            </div>

                                            <label className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-tight">Future Unlock (Future-Dated Release)</span>
                                                    <span className="text-[7px] text-slate-600 uppercase font-black tracking-tighter">Lock until specific date</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={!!policyLockedUntil}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            // Default to +1 hour from now for better UX
                                                            const d = new Date();
                                                            d.setHours(d.getHours() + 1);
                                                            setPolicyLockedUntil(d.toISOString());
                                                        } else {
                                                            setPolicyLockedUntil('');
                                                        }
                                                    }}
                                                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50"
                                                />
                                            </label>

                                            {policyLockedUntil && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="px-2 space-y-2"
                                                >
                                                    {new Date(policyLockedUntil) > new Date() && (
                                                        <div className="flex items-center gap-2 px-2 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-md">
                                                            <Lock className="w-2.5 h-2.5 text-rose-500" />
                                                            <span className="text-[7px] font-black text-rose-500 uppercase tracking-widest">TEMPORAL SHIELD ACTIVE: RELYING ON SYSTEM CLOCK</span>
                                                        </div>
                                                    )}
                                                    <input
                                                        type="datetime-local"
                                                        value={policyLockedUntil && policyLockedUntil.includes('Z') ? new Date(new Date(policyLockedUntil).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : policyLockedUntil}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (!val) {
                                                                setPolicyLockedUntil('');
                                                                return;
                                                            }
                                                            setPolicyLockedUntil(new Date(val).toISOString());
                                                        }}
                                                        className="w-full p-2 bg-black/60 border border-blue-500/20 rounded-lg text-white text-[10px] uppercase font-bold outline-none focus:border-blue-500/50"
                                                    />
                                                </motion.div>
                                            )}

                                            <label className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-tight">Zero-Trace Auto-Wipe</span>
                                                    <span className="text-[7px] text-slate-600 font-bold uppercase tracking-tighter">Clear Clipboard after 30s</span>
                                                </div>
                                                <input type="checkbox" checked={policyAutoWipe} onChange={(e) => setPolicyAutoWipe(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50" />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2 mt-auto border-t border-white/5 flex-shrink-0">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">Cancel</button>
                                    <CyberButton type="submit" className="flex-1 text-[10px] uppercase tracking-widest">
                                        <ShieldCheck className="w-3.5 h-3.5" /> {editingItem ? 'Override Record' : 'Commit to Vault'}
                                    </CyberButton>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showAddVaultModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowAddVaultModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-950 border border-slate-800 p-6 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl space-y-5"
                        >
                            <div className="text-center">
                                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                                    <Plus className="w-7 h-7 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">Add Vault Domain</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Initialize Isolated Cryptosphere</p>
                            </div>

                            <form onSubmit={handleCreateVault} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Domain Name</label>
                                    <input value={newVaultName} onChange={(e) => setNewVaultName(e.target.value)} className="w-full p-4 bg-black/40 border border-slate-800 rounded-2xl focus:border-blue-500/50 outline-none text-white text-xs font-black uppercase tracking-widest transition-all" placeholder="PERSONAL / WORK" autoFocus required />
                                </div>

                                <CyberButton type="submit" className="w-full py-3 text-[11px] uppercase tracking-[0.2em]">
                                    {editingItem ? 'Update Encrypted Record' : 'Commit to Cryptosphere'}
                                </CyberButton>

                                {formError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="pt-4"
                                    >
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
                                            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-tight">{formError}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </form>
                        </motion.div>
                    </div>
                )}

                {showHistoryItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            onClick={() => setShowHistoryItem(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-slate-950 border border-slate-800 p-8 rounded-[2rem] w-full max-w-xl relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />

                            <div className="flex justify-between items-start mb-8">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                                            <History className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-[0.1em]">Encrypted History</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Version Control / Rollback Stream</p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight ml-[52px]">
                                        Site: <span className="text-white">{showHistoryItem.site}</span>
                                    </p>
                                </div>
                                <button onClick={() => setShowHistoryItem(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                {(!showHistoryItem.history || showHistoryItem.history.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Clock className="w-10 h-10 text-slate-800 mb-4" />
                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest max-w-[200px]">
                                            No historical snapshots recorded for this sequence.
                                        </p>
                                    </div>
                                ) : (
                                    showHistoryItem.history.map((version: any, idx: number) => (
                                        <div key={idx} className="group bg-slate-900/40 border border-slate-800/50 rounded-2xl p-5 hover:border-emerald-500/30 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10">v.{showHistoryItem.history.length - idx}</span>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                                                        {new Date(version.versionDate).toLocaleString()}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleRestoreVersion(version)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-500 uppercase tracking-widest transition-all"
                                                >
                                                    <RotateCcw className="w-3 h-3" /> Restore Snapshot
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">User</label>
                                                    <p className="text-[10px] font-bold text-slate-300 truncate">{version.username}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Category</label>
                                                    <p className="text-[10px] font-bold text-slate-300 truncate">{version.category || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="pt-6 border-t border-slate-800 mt-4">
                                <p className="text-[9px] text-center text-slate-700 font-bold uppercase tracking-wider italic">
                                    All versions are stored within the Zero-Knowledge metadata bundle.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
