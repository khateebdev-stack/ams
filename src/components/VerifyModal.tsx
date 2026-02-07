import { useState, useEffect } from 'react';
import { CryptoService } from '@/lib/crypto';
import { EnvironmentService } from '@/lib/environment';
import { Loader2, ShieldAlert, X, Cpu, Eye, EyeOff, ShieldCheck, Lock, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CyberButton from './ui/CyberButton';
import { showToast } from './ui/Toast';

interface Props {
    isOpen?: boolean;
    onClose?: () => void;
    onVerified: (masterKey: Uint8Array) => void;
    userSalt: string;
    expectedAuthHash?: string;
    children?: React.ReactNode;
    actionLabel?: string;
    forceVerify?: boolean;
    session: any;
}

export default function VerifyModal({
    onVerified,
    userSalt,
    expectedAuthHash,
    children,
    session,
    actionLabel,
    forceVerify
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Extract from session if not provided directy (simpler API)
    const salt = userSalt || session?.salt;
    const authHash = expectedAuthHash || session?.authHash;

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setShowPassword(false);
            setError('');
        }
    }, [isOpen]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await CryptoService.init();
            const fingerprint = await EnvironmentService.getFingerprint();
            const masterKey = await CryptoService.deriveMasterKey(password, salt, fingerprint);
            const derivedAuthHash = await CryptoService.hashMasterKeyForAuth(masterKey);

            if (derivedAuthHash === authHash) {
                onVerified(masterKey);
                setPassword('');
                setIsOpen(false);
                showToast('Authorization verified.', 'success');
            } else {
                const msg = 'AUTHENTICATION FAILED: INVALID SEQUENCE OR CONTEXT';
                setError(msg);
                showToast(msg, 'error');
            }
        } catch (err) {
            const msg = 'CRYPTOGRAPHIC VERIFICATION FAILED';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Trigger wrapper */}
            {children && (
                <div onClick={() => setIsOpen(true)} className="contents">
                    {children}
                </div>
            )}

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-950 border border-slate-800 p-8 rounded-[2rem] w-full max-w-sm relative z-10 shadow-2xl overflow-hidden"
                        >
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />

                            <div className="flex justify-between items-start mb-8">
                                <div className="relative">
                                    <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                        <ShieldAlert className="w-7 h-7 text-red-500" />
                                    </div>
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950"
                                    />
                                </div>
                                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2 mb-8 text-left">
                                <h3 className="text-xl font-black text-white uppercase tracking-[0.1em]">{actionLabel || 'Verification Required'}</h3>
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-blue-500" />
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Master Identity Check Required</p>
                                </div>
                            </div>

                            <form onSubmit={handleVerify} className="space-y-6" autoComplete="off">
                                <input type="text" style={{ display: 'none' }} name="fakeusername" />
                                <input type="password" style={{ display: 'none' }} name="fakepassword" />

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="p-3 bg-red-900/20 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2"
                                        >
                                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Sequence</label>
                                    <div className="relative group">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="master-pass-verify"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full p-4 pr-12 bg-black/40 border border-slate-800 rounded-2xl text-white focus:border-red-500/50 outline-none transition-all placeholder:text-slate-800 text-sm font-mono tracking-widest"
                                            placeholder="••••••••••••"
                                            autoComplete="new-password"
                                            autoFocus
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-red-400 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <CyberButton
                                    type="submit"
                                    disabled={loading || !password}
                                    className="w-full py-4 text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-red-900/10"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" />
                                            Authorize Action
                                        </div>
                                    )}
                                </CyberButton>

                                <p className="text-[8px] text-center text-slate-600 font-bold uppercase tracking-tighter">
                                    All actions are cryptographically signed and logged for audit.
                                </p>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
