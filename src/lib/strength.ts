/**
 * Password Strength Utility
 * Evaluates password complexity and returns a score/metadata
 */
export const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: 'Empty', color: 'bg-slate-700' };

    let score = 0;

    // Length check
    if (password.length > 8) score += 1;
    if (password.length > 12) score += 1;

    // Character diversity
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z\d]/.test(password)) score += 1;

    const metadata = [
        { label: 'Very Weak', color: 'bg-red-500' },
        { label: 'Weak', color: 'bg-orange-500' },
        { label: 'Fair', color: 'bg-yellow-500' },
        { label: 'Good', color: 'bg-emerald-500' },
        { label: 'Strong', color: 'bg-blue-500' },
        { label: 'Unbreakable', color: 'bg-indigo-500' },
    ];

    return {
        score,
        ...metadata[score]
    };
};
