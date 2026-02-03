'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, Trash2, X, Lock, KeyRound } from 'lucide-react';
import { CryptoService } from '@/lib/crypto';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDeleted: () => void;
    username: string;
    token: string;
    salt: string;
    twoFactorEnabled: boolean;
}

export default function DeleteAccountModal({ isOpen, onClose, onDeleted, username, token, salt, twoFactorEnabled }: Props) {
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setCode('');
            setError('');
        }
    }, [isOpen]);

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Derive authHash locally (Zero-Knowledge)
            const masterKey = await CryptoService.deriveMasterKey(password, salt);
            const authHash = await CryptoService.hashMasterKeyForAuth(masterKey);

            // 2. Call Delete API
            const res = await fetch('/api/user/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username,
                    authHash,
                    code: twoFactorEnabled ? code : undefined
                })
            });

            const data = await res.json();

            if (res.ok) {
                onDeleted();
            } else {
                setError(data.error || 'Failed to delete account');
            }
        } catch (e: any) {
            setError(e.message || 'An error occurred during deletion');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 backdrop-blur-xl">
            <div className="bg-slate-900 border-2 border-red-500/50 p-8 rounded-2xl w-full max-w-md relative shadow-2xl animate-in zoom-in duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Delete Your Account?</h2>
                    <p className="text-red-400 text-xs font-bold uppercase mt-2 tracking-widest">Danger Zone: This action is permanent.</p>
                </div>

                <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl mb-6 text-sm text-slate-300">
                    <ul className="list-disc list-inside space-y-1">
                        <li>All vault secrets will be wiped.</li>
                        <li>Recovery keys will become void.</li>
                        <li>This action CANNOT be undone.</li>
                    </ul>
                </div>

                <form onSubmit={handleDelete} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Verify Master Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Confirm master password"
                            className="w-full p-4 bg-black border border-slate-700 rounded-xl text-white focus:border-red-500 outline-none transition-all"
                            required
                        />
                    </div>

                    {twoFactorEnabled && (
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                <KeyRound className="w-3 h-3" /> 2FA Verification Code
                            </label>
                            <input
                                type="text"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="w-full p-4 bg-black border border-slate-700 rounded-xl text-white text-center text-xl tracking-widest focus:border-red-500 outline-none"
                                required
                            />
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || (twoFactorEnabled && code.length < 6) || password.length < 8}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xl shadow-red-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                        {loading ? 'Deleting Everything...' : 'Permanently Delete Account'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-slate-500 hover:text-slate-300 text-sm font-bold pt-2 transition-colors"
                    >
                        Nevermind, keep my data safe
                    </button>
                </form>
            </div>
        </div>
    );
}
