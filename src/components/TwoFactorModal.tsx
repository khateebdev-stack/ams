'use client';

import { useState, useEffect } from 'react';
import { Shield, Loader2, CheckCircle2, AlertTriangle, X, Copy, Check } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onEnabled: () => void;
    username: string;
    token: string;
}

export default function TwoFactorModal({ isOpen, onClose, onEnabled, username, token }: Props) {
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setup2FA();
            setCode('');
            setError('');
        }
    }, [isOpen]);

    const handleCopy = () => {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const setup2FA = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/auth/2fa/setup?username=${username}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setQrCode(data.qrCodeUrl);
                setSecret(data.secret);
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError('Failed to load 2FA setup');
        } finally {
            setLoading(false);
        }
    };

    const verify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setVerifying(true);
        setError('');
        try {
            const res = await fetch('/api/auth/2fa/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, code })
            });
            const data = await res.json();
            if (res.ok) {
                onEnabled();
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError('Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-md">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 w-full max-w-md relative shadow-2xl animate-in zoom-in duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Enable 2FA</h2>
                    <p className="text-slate-400 text-sm">Add an extra layer of security to your vault.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-center bg-white p-4 rounded-xl">
                            {qrCode && <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />}
                        </div>

                        <div className="space-y-2">
                            <p className="text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest">Manual Setup Key</p>
                            <div className="relative group">
                                <div className="bg-black p-4 rounded-xl border border-slate-800 text-blue-400 font-mono text-sm break-all leading-relaxed pr-12 shadow-inner">
                                    {secret}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                                    title="Copy Secret"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <form onSubmit={verify2FA} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enter 6-digit Code</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="w-full p-4 bg-black border border-slate-700 rounded-xl text-center text-2xl tracking-[1em] focus:border-blue-500 outline-none text-white font-mono"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg flex gap-2 items-center">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={verifying || code.length < 6}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                            >
                                {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                {verifying ? 'Verifying...' : 'Enable 2FA Now'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
