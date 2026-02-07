# 🕵️ Axiom User Verification & Testing Guide

This guide empowers you to verify Axiom's security claims yourself. You don't have to trust our word; you can test the code and the data.

## 1. Verify "Zero-Knowledge" (Data Privacy)
**Objective**: Proof that the server cannot read your passwords.

1.  **Create an account** and log in.
2.  **Add a secret entry** (e.g., Site: `SecretBank`, Password: `Password123!`).
3.  **Open the database file**: Go to `data/db.json` in the project folder.
4.  **Search for your secret**: Try to find `SecretBank` or `Password123!` in that file.
5.  **Result**: You will find only random strings of characters (Ciphertext). **Even if a hacker steals this file, they see nothing.**

## 2. Verify Cryptographic Isolation (Vault Compartments)
**Objective**: Proof that secrets in one vault are cryptographically separated from another.

1.  **Create a new vault compartment** (e.g., "WORK").
2.  Add a secret to this compartment.
3.  **Inspect the database**: Look at the `vaults` entry in `data/db.json`. 
4.  **Result**: Notice that each vault has its own unique `encryptedSubKey` and `iv`. These are separate cryptographic domains. Deleting or compromising one vault does not expose the keys of another.

## 3. Verify Context-Bound Decryption (CBD)
**Objective**: Proof that your vault is bound to your specific device environment.

1.  **Log in** from your primary browser. Success is expected.
2.  **Open a different browser** (e.g., switch from Chrome to Firefox/Edge) or use Incognito mode.
3.  Attempt to log in with the **correct** password.
4.  **Result**: Axiom will detect the environmental mismatch (Context-Bound Decryption challenge) and block access or require a recovery flow. This proves that even with your password, a hacker cannot access your vault from a different machine.

## 4. Test Inactivity Auto-Lock
**Objective**: Ensure your session is protected if you leave your computer.

1.  **Log in** to your vault.
2.  **Stay idle**: Do not move your mouse or press any keys for the configured lock period.
3.  **Result**: The system will automatically clear the encryption keys from volatile memory and redirect you to the login screen.

## 5. Verify Account Recovery
**Objective**: Proof that your data is recoverable ONLY with your physical Recovery Key.

1.  **Register** a new account and **Copy the Recovery Key** shown.
2.  Add some test data to the vault.
3.  **Log out** and click **"Forgot Password?"** on the login screen.
4.  Enter your username, the **Recovery Key**, and a **New Password**.
5.  **Result**: If the key is correct, you will be able to log in with the new password and see all your old data intact. Axiom re-wraps your vault keys with the new password during this flow.

## 6. Verify Device Trust & 2FA Bypass
**Objective**: Proof that Axiom balances extreme security with user convenience using hardware-bound tokens.

1.  **Enable 2FA** in Settings.
2.  **Log out** and log back in.
3.  On the 2FA screen, enable **"Trust this device"** before entering your code.
4.  **Result 1**: After logging in, go to **Settings -> Trusted Environments**. You will see your device listed with a unique fingerprint and a 30-day expiry.
5.  **Log out and log in again**.
6.  **Result 2**: The 2FA screen is **bypassed**. You are granted access based on the secure Trust Token bound to your machine.
7.  **Revoke Trust** in Settings and log in once more.
8.  **Result 3**: 2FA is **required again**, proving your manual revocation was enforced.

---

## 🛠️ Advanced Tools for Pros
If you are a developer, you can open **Chrome DevTools (F12)** -> **Network Tab**. 
- Observe the `/api/auth/register` and `/api/vault` calls.
- You will notice that **plaintext passwords are NEVER sent** in these requests. We only send hashes and encrypted blobs.

## 🛡️ Hacker Leak Analysis: "What if my data is stolen?"
You asked: *If the encrypted database is leaked, can a hacker decrypt it?*

**The short answer: No.**

1.  **The "Key" is in your head & your device**: The data is encrypted using a **Vault Sub-Key**, which is wrapped (encrypted) with your **Master Password** PLUS your **Environment Fingerprint** (CBD).
2.  **XChaCha20-Poly1305**: We use this industry-standard algorithm. It is so strong that even if every supercomputer on Earth worked together for **millions of years**, they could not decrypt a single file without the password.
3.  **Argon2id Brute-Force Shield**: Every guess attempt requires significant memory and CPU time (hashing delay). This makes automated $10,000/sec guessing attacks physically impossible.

**Conclusion**: Your data is mathematically locked. Leaked data is mathematically useless to a hacker without both your physical machine context and your secret password.
