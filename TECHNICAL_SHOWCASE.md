# Axiom: Technical Showcase & Engineering Journey

A comprehensive breakdown of the architectural decisions, cryptographic protocols, engineering challenges, and learnings developed during the creation of **Axiom: Advanced Security Control System**. This document is tailored for engineering teams and technical evaluators at top-tier technology institutions (e.g., Google, Microsoft, Meta) to understand the depth of engineering applied to this system.

---

## 1. Executive Summary

Axiom is a **Zero-Knowledge, High-Assurance Password and Secrets Management System**. It was built to solve a critical flaw in traditional authentication: assuming the server or database is a safe place to store cryptographic trust. 

Axiom operates on the principle of **Distrust by Design**. The server is treated as a hostile environment. All encryption, decryption, and key derivation happen strictly within the volatile memory of the client's browser. The server only routes and stores mathematically indistinguishable noise (encrypted blobs).

### Key Technical Achievements:
- **Zero-Knowledge Architecture:** No plaintext data, encryption keys, or brute-forceable hashes are ever transmitted over the network.
- **Context-Bound Decryption (CBD):** Cryptographic keys are mathematically bound to the user's specific browser/device fingerprint, preventing stolen database dumps from being decrypted even *if* the master password is known.
- **Polymorphic Encrypted Storage:** Developed a unified encryption pipeline that securely handles varying data schemas (Logins, Bank Accounts, Credit Cards) without exposing the metadata structure to the backend.
- **Threat-Aware Active Defense:** Implemented "Honey-tokens"—fake credentials that, if accessed, trigger silent backend alarms and lock down the vault.

---

## 2. Core Cryptographic Flow

The heart of Axiom is its `CryptoService`, which orchestrates multiple cryptographic primitives to ensure mathematically guaranteed security.

### Key Derivation
Instead of a simple password hash, Axiom derives two mathematically distinct keys from the single Master Password using **Argon2id** (memory-hard, GPU-resistant):
1. **AuthHash:** Sent to the server for authentication (proving identity).
2. **VaultKey:** Never leaves the device. Used to encrypt/decrypt the payload.

Because these keys are distinct, compromising the server's AuthHash database gives an attacker zero mathematical advantage in deriving the VaultKey.

### The Cryptographic Pipeline
1. **Device Fingerprinting (CBD):** We generate a deterministic fingerprint of the browser environment.
2. **Salted KDF:** The `Master Password` + `Fingerprint` + `Server Salt` are run through Argon2id to generate the 256-bit `VaultKey`.
3. **Symmetric Encryption:** Secrets are serialized to JSON and encrypted using **XChaCha20-Poly1305** (AEAD algorithm). 
4. **Key Wrapping for Recovery:** To enable account recovery, a 256-bit `RecoveryKey` is generated on sign-up. The `VaultKey` is encrypted *using* the `RecoveryKey` and stored on the server. If the user forgets their password, they provide the `RecoveryKey` to unwrap the `VaultKey` and re-encrypt the vault with a new password.

---

## 3. Hardware Identity Shield (Passkeys)

To elevate security beyond passwords, we integrated FIDO2/WebAuthn hardware passkeys (e.g., YubiKeys, TouchID) into the core flow.

### The PRF Extension Integration
Traditional passkeys authenticate but don't inherently encrypt data. We engineered a solution combining WebAuthn with the **hmac-secret (PRF) extension**. 
- During login, the hardware security key mathematically evaluates a challenge.
- The output of this evaluation is securely mixed into the Argon2id key derivation pipeline.
- **Result:** The vault is cryptographically bound to the physical hardware key. A stolen laptop is useless without the physical key plugged in.

---

## 4. Engineering Challenges & Solutions

Building a state-of-the-art security platform locally presented several complex engineering challenges.

### Challenge 1: Next.js 15 Asynchronous Cookie Handshake
**The Problem:** During the implementation of the Passkey "Identity Shield," we needed a way to pass cryptographic challenges between the client and the Server-Side Rendered (SSR) API without requiring the user to type their username. Next.js 15 introduced breaking changes where `cookies()` became an asynchronous Promise, causing race conditions in our verification pipeline and returning HTML 500 error pages to a JSON parser, leading to obscure `Unexpected token '<'` errors.
**The Solution:** We meticulously refactored our API routes to `await cookies()`, established an HTTP-only short-lived cookie session strictly for the WebAuthn challenge, and implemented a robust frontend interception layer that caught HTML crash pages, extracted the exact server stack trace, and rendered user-friendly cryptographic failure UI.

### Challenge 2: WebAuthn API Evolution (V10+ & Base64URL)
**The Problem:** The `@simplewebauthn` standard shifted significantly in version 10+, changing how it accepts `startAuthentication` parameters and strictly enforcing `Uint8Array` Base64URL encodings for credential IDs. This caused our mock Node.js backend to corrupt FIDO2 keys during the registration-to-login pipeline. Furthermore, hardware keys that only supported "User Presence" (touch) were failing because the server strictly demanded "User Verification" (biometrics).
**The Solution:** We rewrote the DB interaction layer to correctly intercept and transform Base64 encoding cleanly without Buffer corruption. We updated the API request schemas to `userVerification: 'discouraged'` to gracefully degrade security token requirements, successfully allowing standard YubiKey touch-verifications alongside biometric macOS TouchID passes.

### Challenge 3: Polymorphic Encrypted Data Structures
**The Problem:** Expanding from simple "Usernames/Passwords" to "Bank Accounts (IBAN/Swift)" and "Credit Cards" required changing the shape of our data. Since all metadata is encrypted into an opaque blob, the client UI needed a secure way to know *which* React form to render upon decryption without leaking the type of record to the server.
**The Solution:** We engineered a nested `metadata` wrapper inside the encrypted payload. The server routes an ambiguous `Item`. The client decrypts the payload, reads a secure `type` discriminator inside the decrypted JSON, and dynamically hydrates the correct polymorphic React Component (Bank Form vs Card Form) in real-time.

---

## 5. Modern Technology Stack

- **Framework:** Next.js 15 (App Router, Server Actions)
- **Language:** TypeScript (Strict typing for cryptographic APIs)
- **UI/UX:** React 19, Tailwind CSS, Framer Motion (Premium glassmorphism and 60fps micro-animations)
- **Cryptography Core:** Libsodium (XChaCha20-Poly1305, Argon2id) via `libsodium-wrappers`
- **FIDO2 Hardware Auth:** `@simplewebauthn/server` & `@simplewebauthn/browser`

---

## Conclusion
Axiom is more than a password manager; it is a demonstration of extremely defensive programming, deeply integrated user experience design, and modern web architecture. It showcases the ability to research complex, rapidly evolving security standards (WebAuthn PRF) and successfully deploy them into a frictionless React-based application.
