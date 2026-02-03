'use client';

import { useState, useEffect } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, LockOpen, LogIn, Shield, ArrowLeft, Cpu } from 'lucide-react';

interface Props {
    onSuccess: (session: any) => void;
    onSwitchToRegister: () => void;
    onOpenRecovery: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister, onOpenRecovery }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
            const saltRes = await fetch(`/api/user/salt?username=${username}`);
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
            setError("Login failed. Check credentials.");
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
        } catch (err: any) {
            setError(err.message || "Invalid 2FA code");
        } finally {
            setLoading(false);
        }
    };

    if (show2FA) {
        return (
            <form onSubmit={handle2FAVerify} className="space-y-6 animate-in zoom-in duration-300">
                <div className="text-center mb-6">
                    <button type="button" onClick={() => setShow2FA(false)} className="absolute left-0 top-0 p-2 text-slate-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">2FA Verification</h2>
                    <p className="text-slate-400 text-sm">Enter the code from your authenticator app.</p>
                </div>

                {error && (
                    <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded">
                        {error}
                    </div>
                )}

                <div>
                    <input
                        type="text"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl text-center text-3xl tracking-[0.5em] focus:border-blue-500 outline-none text-white font-mono"
                        placeholder="000000"
                        autoFocus
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || twoFactorCode.length < 6}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20 transition-all font-bold"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    {loading ? 'Verifying...' : 'Verify & Unlock'}
                </button>
            </form>
        );
    }

    return (
        <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-blue-400 italic flex justify-center items-center gap-2 tracking-tight">
                    <LockOpen className="w-6 h-6 not-italic" /> UNLOCK AXIOM
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mt-3">
                    <Cpu className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Secure Context Active</span>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded">
                    {error}
                </div>
            )}

            <div className="mb-4">
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded focus:border-emerald-500 outline-none text-slate-200 transition-colors"
                    placeholder="Your username"
                    autoComplete="username"
                    required
                />
            </div>

            <div className="mb-4">
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Master Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded focus:border-blue-500 outline-none text-slate-200 transition-colors"
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {loading ? 'Decrypting Access...' : 'Authenticate'}
            </button>

            <div className="flex justify-between items-center text-sm pt-4">
                <button type="button" onClick={onSwitchToRegister} className="text-slate-400 hover:text-blue-400 underline decoration-slate-600 hover:decoration-blue-500 transition-all">
                    Initialize Access
                </button>
                <button type="button" onClick={onOpenRecovery} className="text-slate-500 hover:text-slate-400">
                    Forgot Password?
                </button>
            </div>
        </form>
    );
}
