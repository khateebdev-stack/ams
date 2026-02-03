# 🕵️ User Verification & Testing Guide

This guide empowers you to verify our security claims yourself. You don't have to trust our word; you can test the code and the data.

## 1. Verify "Zero-Knowledge" (Data Privacy)
**Objective**: Proof that the server cannot read your passwords.

1.  **Create an account** and log in.
2.  **Add a secret entry** (e.g., Site: `SecretBank`, Password: `Password123!`).
3.  **Open the database file**: Go to `data/db.json` in the project folder.
4.  **Search for your secret**: Try to find `SecretBank` or `Password123!` in that file.
5.  **Result**: You will find only random strings of characters (Ciphertext). **Even if a hacker steals this file, they see nothing.**

## 2. Test Inactivity Auto-Lock
**Objective**: Ensure your session is protected if you leave your computer.

1.  **Log in** to your vault.
2.  **Stay idle**: Do not move your mouse or press any keys for **5 minutes**.
3.  **Result**: The system will automatically clear the encryption keys from memory and redirect you to the login screen.

## 3. Test Master Password Reprompt
**Objective**: Prevent accidental or unauthorized views/copies.

1.  Find any entry in your vault.
2.  Click the **View (Eye)** icon or **Copy** icon.
3.  **Result**: A modal will appear asking for your Master Password. This ensures that even if someone handles your unlocked computer, they cannot see your passwords without the Master Key.

## 4. Verify Account Recovery
**Objective**: Proof that your data is recoverable ONLY with your key.

1.  **Register** a new account and **Copy the Recovery Key** shown.
2.  Add some test data to the vault.
3.  **Log out** and click **"Forgot Password?"** on the login screen.
4.  Enter your username, the **Recovery Key**, and a **New Password**.
5.  **Result**: If the key is correct, you will be able to log in with the new password and see all your old data intact.

## 5. Inspect Audit Logs
**Objective**: Transparency in security actions.

1.  Perform various actions: View a password, download the emergency kit, or fail a login.
2.  Go to **Settings**.
3.  Check the **Recent Activity** sidebar.
4.  **Result**: You will see a timestamped log of exactly what happened. This helps you detect if anyone else tried to access your account.

---

---

## 🛠️ Advanced Tools for Pros
If you are a developer, you can open **Chrome DevTools (F12)** -> **Network Tab**. 
- Observe the `/api/auth/register` and `/api/vault` calls.
- You will notice that **plaintext passwords are NEVER sent** in these requests. We only send hashes and encrypted blobs.

## 🛡️ Hacker Leak Analysis: "What if my data is stolen?"
You asked: *If the encrypted form data is leaked, can a hacker decrypt it?*

**The short answer: No.**

Here is the technical reason why your data is safe even after a leak:

1.  **The "Key" is in your head**: The data is encrypted using a **Vault Key**, which is wrapped (encrypted) with your **Master Password**. Since the server never receives your password, it has no way to "unwrap" the key.
2.  **XChaCha20-Poly1305**: We use this industry-standard algorithm. It is so strong that even if every supercomputer on Earth worked together for **millions of years**, they could not decrypt a single file without the password.
3.  **No Backdoors**: There is no "master reset" or "admin view" on our server. If the database is leaked, the hacker just gets a pile of random numbers.
4.  **Brute-Force Shield (Argon2id)**: If a hacker tries to guess your password using a computer, it will fail because our system makes the computer work very hard (1.5 seconds) for every single guess. This makes "fast guessing" impossible.

**Conclusion**: Your data is mathematically locked. As long as your Master Password is strong and kept secret, the leaked data is **useless** to a hacker.
