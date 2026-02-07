import CryptoJS from 'crypto-js';
import { EnvironmentService } from './environment';

export interface TrustToken {
    id: string;
    token: string;
    fingerprintHash: string;
    expiresAt: string;
    deviceName: string;
}

export class TrustService {
    private static STORAGE_KEY = 'axiom_trust_context';

    /**
     * Stores a trust token locally
     */
    static saveTrustToken(tokenData: TrustToken) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokenData));
    }

    /**
     * Retrieves the local trust token if it exists and hasn't expired
     */
    static getLocalTrustToken(): TrustToken | null {
        if (typeof window === 'undefined') return null;
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (!data) return null;

        try {
            const token: TrustToken = JSON.parse(data);
            if (new Date(token.expiresAt) < new Date()) {
                this.revokeLocalTrust();
                return null;
            }
            return token;
        } catch (e) {
            return null;
        }
    }

    /**
     * Clears local trust
     */
    static revokeLocalTrust() {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * Verifies if the current environment matches the stored trust token
     */
    static async isDeviceTrusted(): Promise<boolean> {
        const token = this.getLocalTrustToken();
        if (!token) return false;

        const currentFingerprint = await EnvironmentService.getFingerprint();
        return token.fingerprintHash === currentFingerprint;
    }
}
