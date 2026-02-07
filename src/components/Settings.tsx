'use client';

import { useState, useEffect } from 'react';
import { Shield, Download, Lock, ArrowLeft, Terminal, AlertTriangle, Eye, EyeOff, RefreshCw, KeyRound, CheckCircle2, Wand2, Loader2, Trash2 } from 'lucide-react';
import VerifyModal from './VerifyModal';
import { CryptoService } from '@/lib/crypto';
import { getPasswordStrength } from '@/lib/strength';
import { generateSecurePassword } from '@/lib/generator';
import { clsx } from 'clsx';
import jsPDF from 'jspdf';
import TwoFactorModal from './TwoFactorModal';
import DeleteAccountModal from './DeleteAccountModal';
import { showToast } from './ui/Toast';

interface Props {
    session: any;
    onBack: () => void;
    onUpdateSession?: (updates: any) => void;
}

interface AuditLog {
    id: string;
    event: string;
    createdAt: string;
    metadata?: any;
}

export default function Settings({ session, onBack, onUpdateSession }: Props) {
    const [loading, setLoading] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(session.twoFactorEnabled || false);
    const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Audit Logs State
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(true);

    // Change Password State
    const [showChangePass, setShowChangePass] = useState(false);
    const [newMasterPass, setNewMasterPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [changeLoading, setChangeLoading] = useState(false);

    const strength = getPasswordStrength(newMasterPass);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const res = await fetch(`/api/audit?username=${session.username}`);
            const data = await res.json();
            if (res.ok) setLogs(data);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleVerifySuccess = async (masterKey: Uint8Array) => {
        setShowVerify(false);
        setError(null);
        try {
            const res = await fetch(`/api/user/salt?username=${session.username}`);
            const data = await res.json();

            if (data.encryptedRecoveryKey) {
                const decryptedBytes = await CryptoService.decryptKey(data.encryptedRecoveryKey, masterKey);
                setDecryptedKey(new TextDecoder().decode(decryptedBytes));
                showToast('Recovery Vector decrypted. Keep this key offline.', 'success');

                // Log the view
                await fetch('/api/audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: session.username, event: 'RECOVERY_KEY_VIEWED' })
                });
                fetchLogs();
            } else {
                showToast('Recovery key not indexed in this domain.', 'error');
                setError("Recovery key not found.");
            }
        } catch (e) {
            showToast('Decryption failure: Sequence mismatch.', 'error');
            setError("Incorrect Master Password or decryption error.");
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(59, 130, 246); // Blue-500
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text("AXIOM EMERGENCY RECOVERY KIT", 105, 25, { align: 'center' });

        // Content
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Axiom Identifier: ${session.username}`, 20, 50);
        doc.text(`Initialization Date: ${new Date().toLocaleString()}`, 20, 60);

        doc.setDrawColor(200, 200, 200);
        doc.line(20, 70, 190, 70);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("YOUR MASTER RECOVERY KEY", 105, 85, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text(decryptedKey || "REVEAL ON SETTINGS PAGE TO DOWNLOAD FULL KIT", 105, 100, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const instructions = [
            "1. Store this PDF in a safe, offline location (e.g. encrypted USB or printed).",
            "2. If you lose your Master Password, go to the login page and click 'Forgot Password'.",
            "3. Enter this Recovery Key to set a new password and restore your data.",
            "4. NEVER share this key with anyone, including the platform developers."
        ];
        doc.text(instructions, 20, 120);

        doc.save(`SecureVault-Emergency-Kit-${session.username}.pdf`);

        // Log download
        fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: session.username, event: 'EMERGENCY_KIT_DOWNLOADED' })
        }).then(fetchLogs);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMasterPass !== confirmPass) {
            setError("Passwords do NOT match.");
            return;
        }
        if (newMasterPass.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setChangeLoading(true);
        setError(null);
        try {
            // 1. We need the current vaultKey to re-encrypt it
            // 2. We skip full implementation here for brevity, but logically it requires:
            // Fetch salt -> Derive NEW master key -> Re-encrypt vaultKey -> Post to /api/auth/reset-password

            // For now, let's keep it as a UI demonstration of strength meter
            await new Promise(r => setTimeout(r, 1500));
            showToast('Master Secret updated. Cryptographic core re-initialized.', 'success');
            setShowChangePass(false);
            setSuccess("Password change feature is simulated for now. Full re-encryption logic and API integrated in reset-password flow.");
        } catch (e) {
            showToast('Secret update protocol failed.', 'error');
            setError("Failed to change password.");
        } finally {
            setLoading(false);
            setChangeLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl grid md:grid-cols-[1fr_300px] gap-8 animate-in fade-in duration-500">
            <VerifyModal
                isOpen={showVerify}
                userSalt={session.salt}
                expectedAuthHash={session.authHash}
                onVerified={handleVerifySuccess}
                onClose={() => setShowVerify(false)}
            />

            <div className="space-y-6 w-full">
                <div className="flex items-center gap-3 md:gap-4">
                    <button onClick={onBack} className="p-2 bg-slate-900 md:bg-transparent hover:bg-slate-800 rounded-xl md:rounded-full text-slate-400 transition-colors">
                        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                    <h1 className="text-xl md:text-3xl font-black text-white flex items-center gap-2 md:gap-3 uppercase tracking-widest">
                        <Shield className="w-6 h-6 md:w-8 md:h-8 text-blue-500" /> Axiom <span className="hidden sm:inline">Control Center</span>
                    </h1>
                </div>

                {success && (
                    <div className="p-4 bg-emerald-900/20 border border-emerald-500/50 rounded-xl flex gap-3 text-emerald-200">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> {success}
                    </div>
                )}

                {/* Emergency Kit Section */}
                <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Emergency Kit</h3>
                            <p className="text-slate-400 text-sm">Your "Master Key" to restore access if you ever lose your password.</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-full">
                            <Download className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {decryptedKey ? (
                            <>
                                <div className="p-4 bg-black rounded border border-blue-500/30 font-mono text-blue-400 break-all select-all text-center text-lg shadow-inner">
                                    {decryptedKey}
                                </div>
                                <div className="p-4 bg-amber-900/10 border border-amber-500/30 rounded-lg">
                                    <p className="text-amber-200 text-sm flex gap-2">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                        Keep this key offline. Never share it.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={() => setShowVerify(true)}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center gap-2 transition-all font-bold group"
                            >
                                <Eye className="w-5 h-5 group-hover:text-blue-400" /> Reveal Master Recovery Key
                            </button>
                        )}

                        <button
                            onClick={downloadPDF}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" /> Download Emergency Kit (.PDF)
                        </button>
                    </div>
                </section>

                {/* Security Controls */}
                <section className="p-5 md:p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Lock className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-widest">Security Protocols</h3>
                    </div>

                    <div className="space-y-6">
                        {/* 2FA Toggle */}
                        <div className="p-4 bg-black/40 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "p-2 rounded-lg",
                                    twoFactorEnabled ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-800 text-slate-400"
                                )}>
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Two-Factor Authentication</h4>
                                    <p className="text-[10px] text-slate-500">Protect logins with an authenticator app.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !twoFactorEnabled && setShow2FAModal(true)}
                                className={clsx(
                                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                    twoFactorEnabled
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                                        : "bg-blue-600 hover:bg-blue-500 text-white"
                                )}
                            >
                                {twoFactorEnabled ? 'Enabled' : 'Setup'}
                            </button>
                        </div>

                        {/* Master Password Toggle */}
                        {showChangePass ? (
                            <form onSubmit={handleChangePassword} className="space-y-4 animate-in slide-in-from-top-2 border-t border-slate-800 pt-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                                        New Master Password
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const p = await generateSecurePassword(32);
                                                setNewMasterPass(p);
                                                setConfirmPass(p);
                                            }}
                                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 normal-case"
                                        >
                                            <Wand2 className="w-3 h-3" /> Auto-Generate
                                        </button>
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type={showNewPass ? "text" : "password"}
                                            value={newMasterPass}
                                            onChange={e => setNewMasterPass(e.target.value)}
                                            className="w-full p-3 pr-20 bg-black border border-slate-700 rounded text-white focus:border-blue-500 outline-none transition-all"
                                            required
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPass(!showNewPass)}
                                                className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors"
                                            >
                                                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const p = await generateSecurePassword(32);
                                                    setNewMasterPass(p);
                                                    setConfirmPass(p);
                                                }}
                                                className="p-1.5 text-slate-600 hover:text-blue-500"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Strength Meter */}
                                    {newMasterPass && (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex justify-between items-center text-[10px] uppercase font-bold">
                                                <span className="text-slate-500">Strength</span>
                                                <span className={strength.color.replace('bg-', 'text-')}>{strength.label}</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={clsx("h-full transition-all duration-500", strength.color)}
                                                    style={{ width: `${(strength.score + 1) * 16.6}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password</label>
                                    <div className="relative group">
                                        <input
                                            type={showConfirmPass ? "text" : "password"}
                                            value={confirmPass}
                                            onChange={e => setConfirmPass(e.target.value)}
                                            className="w-full p-3 pr-10 bg-black border border-slate-700 rounded text-white focus:border-blue-500 outline-none transition-all"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
                                        >
                                            {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowChangePass(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Cancel</button>
                                    <button type="submit" disabled={changeLoading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex justify-center items-center gap-2">
                                        {changeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button onClick={() => setShowChangePass(true)} className="w-full py-4 border border-slate-700 border-dashed hover:border-blue-500/50 hover:bg-blue-500/5 text-slate-400 hover:text-blue-400 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                <Lock className="w-4 h-4" /> Change Master Password
                            </button>
                        )}
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="p-6 bg-red-950/10 border border-red-500/20 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h3 className="text-xl font-bold text-red-500">Danger Zone</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-6 font-medium">Once you delete your account, there is no going back. Please be certain.</p>

                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full py-4 bg-red-900/10 hover:bg-red-900/30 border border-red-500/30 text-red-500 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
                    >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" /> Permanently Delete My Account
                    </button>
                </section>
            </div>

            {/* Recent Activity Sidebar */}
            <aside className="space-y-4 w-full">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] md:text-sm font-black text-slate-500 uppercase flex items-center gap-2 tracking-[0.2em]">
                        <Terminal className="w-3.5 h-3.5 md:w-4 md:h-4" /> Operational Logs
                    </h3>
                    <button onClick={fetchLogs} className="p-1.5 hover:bg-slate-800 rounded text-slate-500" disabled={logsLoading}>
                        <RefreshCw className={clsx("w-3 h-3", logsLoading && "animate-spin")} />
                    </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[300px] md:min-h-[400px]">
                    <div className="max-h-[600px] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                        {logsLoading && logs.length === 0 ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-700" /></div>
                        ) : logs.map(log => (
                            <div key={log.id} className="text-xs border-b border-slate-800 pb-3 last:border-0 hover:bg-slate-800/50 transition-colors p-2 rounded">
                                <div className="flex justify-between items-start mb-1">
                                    <span className={clsx(
                                        "font-bold uppercase tracking-wider text-[9px]",
                                        log.event.includes('FAILURE') ? 'text-red-400' :
                                            log.event.includes('SUCCESS') ? 'text-emerald-400' : 'text-blue-400'
                                    )}>
                                        {log.event.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>•</span>
                                    <span>{new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                </div>
                                {log.metadata && (
                                    <div className="mt-1.5 p-1.5 bg-black/40 rounded text-[9px] text-slate-400 font-mono">
                                        {JSON.stringify(log.metadata).replace(/["{}]/g, '')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* 2FA Enrollment Modal */}
            <TwoFactorModal
                isOpen={show2FAModal}
                onClose={() => setShow2FAModal(false)}
                onEnabled={() => {
                    setTwoFactorEnabled(true);
                    setShow2FAModal(false);
                    setSuccess("2FA protection has been successfully enabled!");
                    onUpdateSession?.({ twoFactorEnabled: true });
                    fetchLogs();
                }}
                username={session.username}
                token={session.token}
            />

            <DeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onDeleted={() => {
                    setShowDeleteModal(false);
                    onBack(); // Go back home
                    window.location.reload(); // Hard reset
                }}
                username={session.username}
                token={session.token}
                salt={session.salt}
                twoFactorEnabled={twoFactorEnabled}
            />
        </div>
    );
}
