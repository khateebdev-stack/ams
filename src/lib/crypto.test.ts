// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { CryptoService } from './crypto';

describe('CryptoService', () => {
    beforeAll(async () => {
        await CryptoService.init();
    });

    it('should generate a salt', () => {
        const salt = CryptoService.generateSalt();
        expect(salt).toBeDefined();
        expect(salt.length).toBeGreaterThan(0);
    });

    it('should derive a master key (Argon2id)', async () => {
        const salt = CryptoService.generateSalt();
        const startTime = Date.now();
        const key = await CryptoService.deriveMasterKey('password123', salt);
        const duration = Date.now() - startTime;

        expect(key).toBeDefined();
        expect(key.length).toBe(32); // 32 bytes = 256 bits
        console.log(`Argon2id derivation took ${duration}ms`);
    });

    it('should encrypt and decrypt a vault key', async () => {
        const salt = CryptoService.generateSalt();
        const masterKey = await CryptoService.deriveMasterKey('password123', salt);
        const vaultKey = CryptoService.generateVaultKey();

        const encrypted = await CryptoService.encryptKey(vaultKey, masterKey);
        const decrypted = await CryptoService.decryptKey(encrypted, masterKey);

        expect(decrypted).toEqual(vaultKey);
    });

    it('should encrypt and decrypt generic string data', async () => {
        const vaultKey = CryptoService.generateVaultKey();
        const secret = "My Secret Data - 123456";
        const { encryptedData, iv } = await CryptoService.encryptData(secret, vaultKey);

        const decrypted = await CryptoService.decryptData(encryptedData, iv, vaultKey);
        expect(decrypted).toBe(secret);
    });

    it('should generate a recovery key (raw hex)', () => {
        const key1 = CryptoService.generateRecoveryKey();
        const key2 = CryptoService.generateRecoveryKey();
        expect(key1).toBeDefined();
        expect(key1).not.toBe(key2);
        expect(key1.length).toBeGreaterThan(32); // Hex string
    });

    it('should derive a key from a recovery code', async () => {
        const recoveryCode = CryptoService.generateRecoveryKey();
        const salt = CryptoService.generateSalt();
        const key = await CryptoService.deriveRecoveryKey(recoveryCode, salt);
        expect(key).toBeDefined();
        expect(key.length).toBe(32);
    });

    it('should throw an error when decrypting with the wrong key', async () => {
        const keyA = CryptoService.generateVaultKey();
        const keyB = CryptoService.generateVaultKey();
        const secret = "Sensitive Data";

        const { encryptedData, iv } = await CryptoService.encryptData(secret, keyA);

        // Decrypting with Key B should fail
        await expect(CryptoService.decryptData(encryptedData, iv, keyB))
            .rejects.toThrow();
    });

    it('should throw an error for corrupted encrypted data', async () => {
        const key = CryptoService.generateVaultKey();
        const { encryptedData, iv } = await CryptoService.encryptData("test", key);

        // Corrupt the ciphertext
        const corruptedData = encryptedData.substring(0, 10) + 'f' + encryptedData.substring(11);

        await expect(CryptoService.decryptData(corruptedData, iv, key))
            .rejects.toThrow();
    });
});
