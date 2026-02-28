'use client';

import { useState } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, KeyRound, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
    onSuccess: () => void;
    onBack: () => void;
}

export default function Recovery({ onSuccess, onBack }: Props) {
    const [username, setUsername] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await CryptoService.init();

            // 1. Fetch user recovery data (salts/encrypted keys)
            const res = await fetch(`/api/user/salt?username=${username}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'User not found');
            if (!data.recoverySalt || !data.recoveryVaultKey) {
                throw new Error('This account does not have recovery enabled or is an old account.');
            }

            // 2. Derive the key from the provided Recovery Key
            const recoveryMasterKey = await CryptoService.deriveMasterKey(recoveryKey.trim(), data.recoverySalt);

            // 3. Decrypt the VaultKey using the recovery-derived key
            const vaultKey = await CryptoService.decryptKey(data.recoveryVaultKey, recoveryMasterKey);

            // 4. Setup NEW Master Password
            const newSalt = CryptoService.generateSalt();
            const fingerprint = await EnvironmentService.getFingerprint();
            const newMasterKey = await CryptoService.deriveMasterKey(newPassword, newSalt, fingerprint);
            const newAuthHash = await CryptoService.hashMasterKeyForAuth(newMasterKey);
            const newEncryptedVaultKey = await CryptoService.encryptKey(vaultKey, newMasterKey);

            // 5. Update password on server
            const resetRes = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    authHash: newAuthHash,
                    salt: newSalt,
                    encryptedVaultKey: newEncryptedVaultKey
                }),
            });

            if (!resetRes.ok) {
                const resetData = await resetRes.json();
                throw new Error(resetData.error || 'Failed to reset password');
            }

            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Recovery failed. Check your username and key.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center space-y-6 animate-in zoom-in">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Password Reset!</h2>
                <p className="text-slate-400">Your Master Password has been successfully updated. You can now log in.</p>
                <button onClick={onBack} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all">
                    Back to Login
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleRecovery} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-emerald-400">Recover Account</h2>
                <p className="text-slate-500 text-sm">Use your unique Recovery Key</p>
            </div>

            {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded flex gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}
                </div>
            )}

            <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded focus:border-blue-500 outline-none text-slate-200"
                    placeholder="Your username"
                    required
                />
            </div>

            <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Recovery Key (Hex)</label>
                <input
                    type="text"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded font-mono focus:border-blue-500 outline-none text-emerald-400"
                    placeholder="32-character hex key"
                    required
                />
            </div>

            <div className="pt-4 border-t border-slate-800">
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">New Master Password</label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded focus:border-emerald-500 outline-none text-slate-200"
                    placeholder="Enter a new strong password"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-all"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {loading ? 'Recovering...' : 'Reset Password'}
            </button>
        </form>
    );
}
