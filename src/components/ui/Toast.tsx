'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, Info, X, ShieldAlert } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

let toastCount = 0;
let toastListeners: ((messages: ToastMessage[]) => void)[] = [];
let currentMessages: ToastMessage[] = [];

export const showToast = (message: string, type: ToastType = 'info') => {
    const id = `toast-${++toastCount}`;
    currentMessages = [...currentMessages, { id, type, message }];
    toastListeners.forEach(fn => fn(currentMessages));

    setTimeout(() => {
        removeToast(id);
    }, 5000);
};

const removeToast = (id: string) => {
    currentMessages = currentMessages.filter(m => m.id !== id);
    toastListeners.forEach(fn => fn(currentMessages));
};

export default function ToastContainer() {
    const [messages, setMessages] = useState<ToastMessage[]>([]);

    useEffect(() => {
        const listener = (newMessages: ToastMessage[]) => setMessages(newMessages);
        toastListeners.push(listener);
        return () => {
            toastListeners = toastListeners.filter(l => l !== listener);
        };
    }, []);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
                {messages.map((m) => (
                    <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 50, scale: 0.9 }}
                        className={clsx(
                            "pointer-events-auto min-w-[320px] max-w-md p-4 rounded-2xl border flex items-start gap-4 shadow-2xl backdrop-blur-xl",
                            m.type === 'success' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                            m.type === 'error' && "bg-red-500/10 border-red-500/20 text-red-400",
                            m.type === 'info' && "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}
                    >
                        <div className="shrink-0 mt-0.5">
                            {m.type === 'success' && <CheckCircle className="w-5 h-5" />}
                            {m.type === 'error' && <ShieldAlert className="w-5 h-5" />}
                            {m.type === 'info' && <Info className="w-5 h-5" />}
                        </div>

                        <div className="flex-1 flex flex-col gap-1 pr-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
                                {m.type === 'success' ? 'Operation Success' : m.type === 'error' ? 'Security Protocol Response' : 'System Intelligence'}
                            </span>
                            <p className="text-[11px] font-bold leading-relaxed">{m.message}</p>
                        </div>

                        <button
                            onClick={() => removeToast(m.id)}
                            className="shrink-0 text-white/20 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
