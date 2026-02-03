import CryptoJS from 'crypto-js';

export async function checkPasswordBreach(password: string): Promise<number> {
    if (!password) return 0;

    try {
        // 1. Generate SHA-1 Hash
        const hash = CryptoJS.SHA1(password).toString().toUpperCase();
        const prefix = hash.slice(0, 5);
        const suffix = hash.slice(5);

        // 2. Fetch suffix list from proxy
        const res = await fetch(`/api/security/breach-check?prefix=${prefix}`);
        if (!res.ok) return 0;

        const text = await res.text();
        const lines = text.split('\n');

        // 3. Find suffix in results
        for (const line of lines) {
            const [foundSuffix, count] = line.split(':');
            if (foundSuffix === suffix) {
                return parseInt(count.trim(), 10);
            }
        }

        return 0;
    } catch (e) {
        console.error("Breach check failed", e);
        return 0;
    }
}
