const _sodium = require('libsodium-wrappers-sumo');
const sodium = _sodium.default || _sodium;

export class CryptoService {
    private static isReady = false;

    static async init() {
        if (!this.isReady) {
            console.log('Initializing Sodium (Sumo Edition)...');
            await sodium.ready;
            this.isReady = true;
            console.log('Sodium Ready. Methods:', Object.keys(sodium).filter(k => k.includes('pwhash')));
            if (typeof sodium.crypto_pwhash !== 'function') {
                console.error('CRITICAL: crypto_pwhash is missing!', sodium);
            }
        }
    }

    /**
     * Generates a random salt for Argon2id
     */
    static generateSalt(): string {
        return sodium.to_hex(sodium.randombytes_buf(16));
    }

    /**
     * Derives a Master Key from the password and salt using Argon2id.
     * Optionally binds the key to a specific 'context' (Device Fingerprint).
     */
    static async deriveMasterKey(password: string, saltHex: string, context?: string): Promise<Uint8Array> {
        await this.init();
        const salt = sodium.from_hex(saltHex);

        // Context-Bound Decryption (CBD) Logic:
        // If context is provided, we mix it into the password to create a unique derivation input
        // bound to this specific device/browser fingerprint.
        const derivationInput = context
            ? sodium.crypto_generichash(32, password + context)
            : password;

        return sodium.crypto_pwhash(
            32,
            derivationInput,
            salt,
            sodium.crypto_pwhash_OPSLIMIT_MODERATE,
            sodium.crypto_pwhash_MEMLIMIT_MODERATE,
            sodium.crypto_pwhash_ALG_ARGON2ID13
        );
    }

    /**
     * Hashes the Master Key to create an Authentication Hash (safe to send to server)
     */
    static async hashMasterKeyForAuth(masterKey: Uint8Array): Promise<string> {
        await this.init();
        // We use a different hash function or different params to avoid correlation
        // Standard generic hash (BLAKE2b) is good here
        return sodium.to_hex(sodium.crypto_generichash(32, masterKey, null));
    }

    /**
     * Generates a random Vault Key (256-bit)
     */
    static generateVaultKey(): Uint8Array {
        return sodium.randombytes_buf(32);
    }

    /**
     * Encrypts the Vault Key using the Master Key (AES-256-GCM or XChaCha20-Poly1305)
     * Libsodium recommends crypto_secretbox (XSalsa20/Poly1305) or crypto_aead_xchacha20poly1305
     * We will use XChaCha20-Poly1305 for high security and random nonce management.
     */
    static async encryptKey(keyToEncrypt: Uint8Array, wrappingKey: Uint8Array): Promise<string> {
        await this.init();
        const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
            keyToEncrypt,
            null,
            null,
            nonce,
            wrappingKey
        );

        // Return Format: nonce + ciphertext (hex encoded)
        return sodium.to_hex(nonce) + ':' + sodium.to_hex(ciphertext);
    }

    /**
     * Decrypts the Vault Key
     */
    static async decryptKey(encryptedPackage: string, wrappingKey: Uint8Array): Promise<Uint8Array> {
        await this.init();
        const [nonceHex, ciphertextHex] = encryptedPackage.split(':');
        if (!nonceHex || !ciphertextHex) throw new Error("Invalid encrypted package format");

        const nonce = sodium.from_hex(nonceHex);
        const ciphertext = sodium.from_hex(ciphertextHex);

        return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            null,
            ciphertext,
            null,
            nonce,
            wrappingKey
        );
    }

    /**
     * Encrypts generic data (string) using the Vault Key
     */
    static async encryptData(data: string, vaultKey: Uint8Array): Promise<{ encryptedData: string; iv: string }> {
        await this.init();
        // Using Web Crypto API (AES-GCM) is preferred for file blobs, but Libsodium is fine too.
        // Let's stick to Libsodium XChaCha20-Poly1305 for consistency and best-in-class security.

        const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
            data,
            null,
            null,
            nonce,
            vaultKey
        );

        return {
            encryptedData: sodium.to_hex(ciphertext),
            iv: sodium.to_hex(nonce) // We verify IV terminology (Nonce in Sodium)
        };
    }

    /**
     * Decrypts generic data
     */
    static async decryptData(encryptedHex: string, nonceHex: string, vaultKey: Uint8Array): Promise<string> {
        await this.init();
        const nonce = sodium.from_hex(nonceHex);
        const ciphertext = sodium.from_hex(encryptedHex);

        const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            null,
            ciphertext,
            null,
            nonce,
            vaultKey
        );
        return sodium.to_string(decrypted);
    }

    /**
     * Generates a random recovery key (256-bit hex)
     */
    static generateRecoveryKey(): string {
        // sodium is available in the module scope
        return sodium.to_hex(sodium.randombytes_buf(32));
    }

    /**
     * Derives a key from a recovery code
     */
    static async deriveRecoveryKey(recoveryCode: string, salt: string): Promise<Uint8Array> {
        return this.deriveMasterKey(recoveryCode, salt);
    }
}
