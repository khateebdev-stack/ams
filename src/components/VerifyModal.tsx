import { useState, useEffect } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, ShieldAlert, X, Cpu } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onVerified: (masterKey: Uint8Array) => void;
    userSalt: string;
    expectedAuthHash: string;
}

export default function VerifyModal({ isOpen, onClose, onVerified, userSalt, expectedAuthHash }: Props) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await CryptoService.init();
            // 1. Derive Key from entered password with Context-Bound Decryption (CBD)
            const fingerprint = await EnvironmentService.getFingerprint();
            const masterKey = await CryptoService.deriveMasterKey(password, userSalt, fingerprint);

            // 2. Hash it to compare with existing authHash
            const authHash = await CryptoService.hashMasterKeyForAuth(masterKey);

            if (authHash === expectedAuthHash) {
                onVerified(masterKey);
                setPassword('');
                onClose();
            } else {
                setError('Authentication Failed: Check Master Password or Secure Context');
            }
        } catch (err) {
            setError('Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-start mb-6">
                    <div className="bg-red-900/20 p-3 rounded-xl border border-red-500/30">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">Verification Required</h3>
                <p className="text-slate-400 text-sm mb-6">Enter your Master Password to perform this sensitive action.</p>

                <form onSubmit={handleVerify} className="space-y-4" autoComplete="off">
                    {/* Dummy hidden inputs to prevent some browsers from autofilling the main password field */}
                    <input type="text" style={{ display: 'none' }} name="fakeusername" />
                    <input type="password" style={{ display: 'none' }} name="fakepassword" />

                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-xs rounded">
                            {error}
                        </div>
                    )}

                    <input
                        type="password"
                        name="master-pass-verify"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-black border border-slate-700 rounded text-white focus:border-red-500 outline-none transition-all placeholder:text-slate-700"
                        placeholder="Master Password"
                        autoComplete="new-password"
                        autoFocus
                        required
                    />

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
