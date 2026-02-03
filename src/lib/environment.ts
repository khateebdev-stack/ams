import CryptoJS from 'crypto-js';

export const EnvironmentService = {
    /**
     * Generates a stable device/browser fingerprint.
     * This is NOT for tracking, but for binding cryptographic keys to a context.
     */
    async getFingerprint(): Promise<string> {
        if (typeof window === 'undefined') return 'server';

        const components = [
            navigator.userAgent,
            navigator.language,
            window.screen.width + 'x' + window.screen.height,
            window.screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.platform,
            // Canvas Fingerprinting (Subtle and Stable)
            this.getCanvasFingerprint()
        ];

        return CryptoJS.SHA256(components.join('|')).toString();
    },

    getCanvasFingerprint(): string {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';

            canvas.width = 200;
            canvas.height = 50;

            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Axiom-CBD-Verification", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Axiom-CBD-Verification", 4, 17);

            return canvas.toDataURL();
        } catch (e) {
            return 'no-canvas';
        }
    }
};
