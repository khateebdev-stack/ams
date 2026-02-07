'use client';

import { useState } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, LockOpen, LogIn, Shield, ArrowLeft, Cpu, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CyberButton from './ui/CyberButton';
import { showToast } from './ui/Toast';

interface Props {
    onSuccess: (session: any) => void;
    onSwitchToRegister: () => void;
    onOpenRecovery: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister, onOpenRecovery }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [show2FA, setShow2FA] = useState(false);
    const [loginContext, setLoginContext] = useState<{ masterKey: Uint8Array, authHash: string, salt: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await CryptoService.init();

            // 1. Get Salt for User
            const saltRes = await fetch(`/api/user/salt?username=${encodeURIComponent(username)}`);
            const saltData = await saltRes.json();
            if (!saltRes.ok || !saltData.salt) throw new Error('User not found or invalid');
            const salt = saltData.salt;

            // 2. Derive Master Key with Context-Bound Decryption (CBD)
            const fingerprint = await EnvironmentService.getFingerprint();
            const masterKey = await CryptoService.deriveMasterKey(password, salt, fingerprint);
            const authHash = await CryptoService.hashMasterKeyForAuth(masterKey);

            // 3. Send Hash to Login API
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, authHash }),
            });

            const loginData = await loginRes.json();
            if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');

            if (loginData.twoFactorRequired) {
                setShow2FA(true);
                setLoginContext({ masterKey, authHash, salt });
                setLoading(false);
                return;
            }

            // 4. Decrypt Vault Key
            const vaultKey = await CryptoService.decryptKey(loginData.encryptedVaultKey, masterKey);

            // 5. Store in Memory (Callback)
            onSuccess({
                username,
                token: loginData.sessionToken,
                twoFactorEnabled: loginData.twoFactorEnabled,
                vaultKey,
                salt,
                authHash,
            });

        } catch (err: any) {
            console.error(err);
            const msg = err.message || "Authorization failed. Check master sequence.";
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handle2FAVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginContext) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login/2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    code: twoFactorCode,
                    authHash: loginContext.authHash
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const vaultKey = await CryptoService.decryptKey(data.encryptedVaultKey, loginContext.masterKey);
            onSuccess({
                username,
                token: data.sessionToken,
                twoFactorEnabled: data.twoFactorEnabled,
                vaultKey,
                salt: loginContext.salt,
                authHash: loginContext.authHash,
            });
            showToast('Two-Factor Verification successful.', 'success');
        } catch (err: any) {
            const msg = err.message || "Invalid 2FA code";
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

    return (
        <AnimatePresence mode="wait">
            {show2FA ? (
                <motion.form
                    key="2fa"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handle2FAVerify}
                    className="space-y-5"
                >
                    <div className="text-center mb-4 relative">
                        <button type="button" onClick={() => setShow2FA(false)} className="absolute left-0 top-0 p-2 text-slate-500 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                            <Shield className="w-7 h-7 text-blue-500" />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-widest uppercase">Verify Identity</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-tighter">Enter Auth-Domain Code</p>
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl text-center">
                            {error}
                        </motion.div>
                    )}

                    <div className="space-y-4">
                        <input
                            type="text"
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full p-5 bg-black/40 border border-slate-800 rounded-2xl text-center text-4xl tracking-[0.5em] focus:border-blue-500 outline-none text-white font-mono shadow-inner font-black"
                            placeholder="000000"
                            autoFocus
                            required
                        />

                        <CyberButton
                            type="submit"
                            isLoading={loading}
                            disabled={twoFactorCode.length < 6}
                            className="w-full"
                        >
                            <Shield className="w-4 h-4" />
                            UNLOCK SECURE SESSION
                        </CyberButton>
                    </div>
                </motion.form>
            ) : (
                <motion.form
                    key="login"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleLogin}
                    className="space-y-4"
                >
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-black text-white flex justify-center items-center gap-2 tracking-widest uppercase">
                            <LockOpen className="w-5 h-5 text-blue-500" /> ACCESS PORTAL
                        </h2>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-full mt-3">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Environment-Bound Protection</span>
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
                            placeholder="Username"
                            autoComplete="username"
                            required
                        />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Master Sequence</label>
                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 pr-12 bg-black/40 border border-slate-800 rounded-2xl focus:border-blue-500/50 outline-none text-white transition-all placeholder:text-slate-800 font-mono"
                                placeholder="••••••••••••"
                                autoComplete="current-password"
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
                    </motion.div>

                    <motion.div variants={itemVariants} className="pt-2">
                        <CyberButton
                            type="submit"
                            isLoading={loading}
                            className="w-full"
                        >
                            <LogIn className="w-4 h-4" />
                            AUTHORIZE ACCESS
                        </CyberButton>
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-2">
                        <button type="button" onClick={onSwitchToRegister} className="text-slate-500 hover:text-blue-500 transition-all">
                            Initialize New Audit
                        </button>
                        <button type="button" onClick={onOpenRecovery} className="text-slate-600 hover:text-slate-400">
                            Lost Key?
                        </button>
                    </motion.div>
                </motion.form>
            )}
        </AnimatePresence>
    );
}
