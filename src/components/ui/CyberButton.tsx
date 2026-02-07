'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface Props extends HTMLMotionProps<"button"> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
    glow?: boolean;
}

export default function CyberButton({
    children,
    className,
    variant = 'primary',
    isLoading,
    glow = true,
    ...props
}: Props) {
    const baseStyles = "relative px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-500",
        secondary: "bg-slate-900/50 text-slate-300 border border-slate-800 hover:border-blue-500/50 hover:text-white glass",
        danger: "bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white",
        ghost: "bg-transparent text-slate-500 hover:text-slate-300"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={twMerge(baseStyles, variants[variant], className)}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Glow Effect */}
            {glow && variant === 'primary' && (
                <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            {isLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : children}
        </motion.button>
    );
}
