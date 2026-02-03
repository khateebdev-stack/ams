'use client';

import { useState, useEffect } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, ShieldCheck, KeyRound, AlertTriangle, Wand2, RefreshCw, Cpu } from 'lucide-react';
import { getPasswordStrength } from '@/lib/strength';
import { generateSecurePassword } from '@/lib/generator';
import { clsx } from 'clsx';

interface Props {
    onSuccess: () => void;
    onSwitchToLogin: () => void;
    onOpenRecovery?: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'form' | 'recovery'>('form');
    const [recoveryKey, setRecoveryKey] = useState('');

    const strength = getPasswordStrength(password);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await CryptoService.init();

            // 1. Generate Salt & Master Key with Context-Bound Decryption (CBD)
            const salt = CryptoService.generateSalt();
            const fingerprint = await EnvironmentService.getFingerprint();
            const masterKey = await CryptoService.deriveMasterKey(password, salt, fingerprint);
            const authHash = await CryptoService.hashMasterKeyForAuth(masterKey);

            // 2. Generate Vault Key (The real key)
            const vaultKey = CryptoService.generateVaultKey();

            // 3. Generate Recovery Key
            const recoveryKeyBytes = CryptoService.generateVaultKey(); // 32 bytes
            const toHex = (arr: Uint8Array) => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            const recKeyHex = toHex(recoveryKeyBytes);
            setRecoveryKey(recKeyHex);

            // 4. Encrypt Vault Key with Master Key
            const encryptedVaultKey = await CryptoService.encryptKey(vaultKey, masterKey);

            // 5. Encrypt Vault Key with Recovery Key (as a password for derivation)
            const recoverySalt = CryptoService.generateSalt();
            const recoveryMasterKey = await CryptoService.deriveMasterKey(recKeyHex, recoverySalt);
            const recoveryVaultKey = await CryptoService.encryptKey(vaultKey, recoveryMasterKey);

            // 6. Encrypt Recovery Key itself with the Master Key (so user can view it in Settings later)
            const encryptedRecoveryKey = await CryptoService.encryptKey(new TextEncoder().encode(recKeyHex), masterKey);

            // 7. Send to API
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    salt,
                    authHash,
                    encryptedVaultKey,
                    // Store recovery-specific data
                    recoverySalt,
                    recoveryVaultKey,
                    // Store the recovery key encrypted with the master key for viewing in Settings
                    encryptedRecoveryKey
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            setStep('recovery'); // Show recovery key step
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'recovery') {
        return (
            <div className="space-y-6 animate-in fade-in zoom-in">
                <div className="bg-amber-900/20 border border-amber-500/50 p-6 rounded-xl">
                    <h3 className="text-amber-500 font-bold flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5" />
                        SAVE THIS RECOVERY KEY
                    </h3>
                    <p className="text-sm text-slate-300 mb-4">
                        This is the <strong>ONLY</strong> way to recover your account if you lose your password.
                        We cannot help you recover it.
                    </p>
                    <div className="bg-black p-4 rounded border border-slate-700 font-mono text-emerald-400 break-all select-all text-center">
                        {recoveryKey}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Copy this and store it in a safe physical location (e.g. a safe).
                    </p>
                </div>
                <button
                    onClick={onSuccess}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all"
                >
                    I have saved it, Initialize Axiom
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-blue-400 italic flex justify-center items-center gap-2 tracking-tight">
                    <ShieldCheck className="w-6 h-6 not-italic" /> INITIALIZE AXIOM
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mt-3">
                    <Cpu className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Environment-Bound Keys Active</span>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded focus:border-blue-500 outline-none text-slate-200"
                    placeholder="unique_username"
                    required
                />
            </div>

            <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1 flex justify-between">
                    Master Password
                    <button
                        type="button"
                        onClick={async () => setPassword(await generateSecurePassword(24))}
                        className="text-blue-500 hover:text-blue-400 flex items-center gap-1 normal-case"
                    >
                        <Wand2 className="w-3 h-3" /> Generate Weak-Proof Password
                    </button>
                </label>
                <div className="relative">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded focus:border-blue-500 outline-none text-slate-200"
                        placeholder="Strong password (min 12 chars recommended)"
                        required
                    />
                </div>

                {/* Strength Meter */}
                {password && (
                    <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold">
                            <span className="text-slate-500">Security Strength</span>
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

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loading ? 'Initializing Axiom Core...' : 'Create Master Access'}
            </button>

            <div className="text-center pt-4">
                <button type="button" onClick={onSwitchToLogin} className="text-sm text-slate-400 hover:text-blue-400">
                    Already an Axiom Operator? Login
                </button>
            </div>
        </form>
    );
}
