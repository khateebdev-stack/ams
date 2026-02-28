# 🛡️ Axiom: Advanced Security Control System

A state-of-the-art "Zero-Knowledge" security platform designed for maximum privacy, high-assurance encryption, and cryptographic isolation. Unlike traditional password managers, Axiom ensures that your Master Password and Plaintext Data **never** leave your device, and adds environmental binding to protect against advanced state-actor threats.

## 🚀 Key Features

- **Zero-Knowledge Architecture**: Encryption and decryption happen entirely on the client side. The server only sees encrypted blobs.
- **Compartmentalized Vaults**: Isolated cryptographic domains (Work, Financial, Personal). Each vault has its own **Sub-Key** wrapped by your Master Vault Key.
- **Context-Bound Decryption (CBD)**: Advanced environmental fingerprinting. Your Master Key is cryptographically bound to your specific device/browser context, making database leaks useless without the exact environment.
- **Argon2id Key Derivation**: Professional-grade, memory-hard protection against brute-force and GPU-accelerated attacks.
- **XChaCha20-Poly1305 Encryption**: High-performance, AEAD (Authenticated Encryption with Associated Data) for all sensitive secrets.
- **Multi-Factor Recovery**: Secure account recovery using a unique 256-bit Recovery Key and encrypted offline backup.
- **Inactivity Auto-Lock**: Automatically clears sensitive keys from memory and locks the UI after a configurable period of idle time.
- **Security Audit Engine**: Real-time logging of sensitive actions (Logins, Secret access, Key rotations).
- **Polymorphic Encrypted Storage**: Secure metadata handling for varied data types (Logins, Bank Accounts, IBANs, Credit Cards) with dynamic rendering.
- **Advanced Two-Factor Authentication (2FA)**: Seamless TOTP integration (Google Authenticator, Authy) with "Double-Lock" protection for sensitive vaults.
- **Real-time Breach Monitoring**: Integrated with k-anonymity breach checking to alert you if your passwords appear in known data leaks.
- **Professional Secure Generator**: One-click generation of cryptographically secure, ultra-high entropy phrases with visual strength metrics.
- **Secure Data Wipe**: Full account multi-factor deletion ensuring absolutely no remnants remain in the database.
- **Hardware Identity Shield (Passkeys)**: FIDO2 WebAuthn integration binding the device master key to a physical hardware token (YubiKey/TouchID).

## 🛠️ Technology Stack

- **Frontend**: [Next.js](https://nextjs.org/) (TypeScript) + [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Cryptography**: [Libsodium](https://libsodium.gitbook.io/) (XChaCha20, Poly1305, Argon2id)
- **Security Engine**: Custom **EnvironmentService** for CBD fingerprinting
- **Backend**: Next.js API Routes (Zero-Trust API Design)
- **Storage**: Pluggable Adapter (JSON Fallback / SQLite / PostgreSQL via Prisma)
- **PDF Core**: [jsPDF](https://github.com/parallax/jsPDF) for Emergency Kit generation

## 📦 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Database Sync
If using Prisma (default for production-ready environments):
```bash
npx prisma db push
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Axiom Dashboard.

## 🔐 Security Philosophy: Distrust by Design

Axiom operates on three non-negotiable pillars:
1. **The Server is Compromised**: The backend is treated as a hostile environment. We store no hashes that can be brute-forced.
2. **The Database is Public**: Every byte in storage is encrypted at rest. Without the client-side environment and password, the data is noise.
3. **The Keys stay Local**: Vault keys only exist in volatile memory while the vault is unlocked. They are never persisted to disk or sent to the network.

---

## 📖 Documentation
- [User Verification Guide](./VERIFICATION_GUIDE.md) - How to test and verify the security yourself.
- [Technical Showcase & Engineering Journey](./TECHNICAL_SHOWCASE.md) - A deep dive into the architectural decisions, cryptographic protocols, zero-knowledge proofs, and engineering challenges solved while building Axiom.
- [Security Walkthrough](./walkthrough.md) - Detailed technical implementation logs and proofs.
- [Audit Logs](./audit_policy.md) - How we handle sensitive event tracking.
