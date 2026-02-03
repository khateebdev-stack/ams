const _sodium = require('libsodium-wrappers-sumo');

/**
 * Built-in Password Generator
 * Uses cryptographically secure random bytes
 */
export const generateSecurePassword = async (length = 20) => {
    const sodium = _sodium.default || _sodium;
    await sodium.ready;

    // Define character sets
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = upper + lower + digits + symbols;

    const bytes = sodium.randombytes_buf(length);
    let result = '';

    // Ensure we have at least one of each for "Good" strength
    result += upper[sodium.randombytes_uniform(upper.length)];
    result += lower[sodium.randombytes_uniform(lower.length)];
    result += digits[sodium.randombytes_uniform(digits.length)];
    result += symbols[sodium.randombytes_uniform(symbols.length)];

    // Fill the rest
    for (let i = 4; i < length; i++) {
        result += all[sodium.randombytes_uniform(all.length)];
    }

    // Shuffle the result
    return result.split('').sort(() => 0.5 - Math.random()).join('');
};
