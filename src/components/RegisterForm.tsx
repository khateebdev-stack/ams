'use client';

import { useState } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, ShieldCheck, KeyRound, AlertTriangle, Wand2, RefreshCw, Cpu, Eye, EyeOff } from 'lucide-react';
import { getPasswordStrength } from '@/lib/strength';
import { generateSecurePassword } from '@/lib/generator';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import CyberButton from './ui/CyberButton';
import { showToast } from './ui/Toast';

interface Props {
    onSuccess: () => void;
    onSwitchToLogin: () => void;
    onOpenRecovery?: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
            showToast('Identity origin established. Secure your recovery vector.', 'success');
        } catch (err: any) {
            console.error(err);
            const msg = err.message || "Initialization protocol failed.";
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, staggerChildren: 0.1 }
        },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -5 },
        visible: { opacity: 1, x: 0 }
    };

    if (step === 'recovery') {
        return (
            <motion.div
                key="recovery"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
            >
                <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-3xl relative overflow-hidden shadow-inner">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-16 -mt-16" />
                    <h3 className="text-amber-500 font-black text-xs tracking-widest flex items-center gap-2 mb-3 uppercase">
                        <AlertTriangle className="w-4 h-4" />
                        CRITICAL RECOVERY VECTOR
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-5 leading-loose">
                        This is the <strong className="text-amber-200">ONLY</strong> way to restore access. Axiom Node Operators cannot bypass this identity lock.
                    </p>
                    <div className="relative group">
                        <div className="bg-black/60 p-5 rounded-2xl border border-slate-800 font-mono text-amber-500 break-all select-all text-center text-sm md:text-md shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] font-black tracking-widest leading-relaxed mb-2">
                            {recoveryKey}
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(recoveryKey);
                                showToast('Recovery Vector copied to clipboard.', 'success');
                            }}
                            className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-[9px] font-black text-amber-500 uppercase tracking-widest transition-all"
                        >
                            Copy Recovery Key
                        </button>
                    </div>
                </div>
                <CyberButton
                    onClick={onSuccess}
                    className="w-full"
                >
                    KEY SECURED: INITIALIZE SYSTEM
                </CyberButton>
            </motion.div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <motion.form
                key="register"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={handleRegister}
                className="space-y-4"
            >
                <div className="text-center mb-4">
                    <h2 className="text-xl font-black text-white flex justify-center items-center gap-2 tracking-widest uppercase">
                        <ShieldCheck className="w-5 h-5 text-blue-500" /> IDENTITY ORIGIN
                    </h2>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full mt-3">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">High-Assurance Key Generation</span>
                    </div>
                </div>

                {error && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl text-center">
                        {error}
                    </motion.div>
                )}

                <motion.div variants={itemVariants}>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Identity Tag</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-4 bg-black/40 border border-slate-800 rounded-2xl focus:border-blue-500/50 outline-none text-white transition-all placeholder:text-slate-800 font-bold"
                        placeholder="Choose unique tag"
                        required
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 flex justify-between items-center group/label">
                        Master Sequence
                        <button
                            type="button"
                            onClick={async () => setPassword(await generateSecurePassword(24))}
                            className="text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                        >
                            <Wand2 className="w-3 h-3 group-hover/label:animate-pulse" />
                            <span className="text-[8px] tracking-tight">AUTO-GENERATE</span>
                        </button>
                    </label>
                    <div className="relative group">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 pr-12 bg-black/40 border border-slate-800 rounded-2xl focus:border-blue-500/50 outline-none text-white transition-all placeholder:text-slate-800 font-mono"
                            placeholder="Entropy required..."
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-blue-500 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Strength Meter */}
                    <AnimatePresence>
                        {password && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2.5 overflow-hidden"
                            >
                                <div className="flex justify-between items-center text-[8px] uppercase font-black tracking-widest mb-1 ml-1 leading-none">
                                    <span className="text-slate-600">Entropy Scale</span>
                                    <span className={clsx("font-black", strength.color.replace('bg-', 'text-'))}>{strength.label}</span>
                                </div>
                                <div className="h-1 w-full bg-black/50 rounded-full overflow-hidden border border-slate-900/50">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(strength.score + 1) * 16.6}%` }}
                                        className={clsx("h-full", strength.color)}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                    <CyberButton
                        type="submit"
                        isLoading={loading}
                        className="w-full"
                    >
                        <KeyRound className="w-4 h-4" />
                        INITIALIZE CRYPTOGRAPHIC CORE
                    </CyberButton>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center pt-2">
                    <button type="button" onClick={onSwitchToLogin} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-blue-500 transition-all">
                        Existing Identity? Access Portal
                    </button>
                </motion.div>
            </motion.form>
        </AnimatePresence>
    );
}
