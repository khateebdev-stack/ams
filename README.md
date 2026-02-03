# 🛡️ Secure Account Management System

A state-of-the-art "Zero-Knowledge" vault system designed for maximum privacy and security. Unlike traditional managers, this system ensures that your Master Password and Plaintext Data **never** leave your device.

## 🚀 Key Features

- **Zero-Knowledge Architecture**: Encryption and decryption happen entirely on the client side. The server only sees encrypted blobs.
- **Argon2id Key Derivation**: Professional-grade protection against brute-force attacks.
- **XChaCha20-Poly1305 Encryption**: High-performance, authenticated encryption for all sensitive data.
- **Multi-Factor Recovery**: Secure account recovery using a unique 256-bit Recovery Key and Emergency Kit.
- **Inactivity Auto-Lock**: Automatically clears sensitive keys from memory after 5 minutes of idle time.
- **Security Audit Logs**: Track every sensitive action (Logins, Secrets accessed, Recovery used).
- **Professional Emergency Kit**: Downloadable PDF containing everything you need to recover your data.
- **Advanced Two-Factor Authentication (2FA)**: Secure your vault with an extra layer of protection using TOTP-based apps like Google Authenticator or Authy.
- **Double-Lock Security**: Critical encryption keys are only released after successful 2FA verification.
- **Real-time Password Strength Analysis**: Dynamic feedback as you type to ensure maximum entropy.
- **Built-in Secure Generator**: One-click generation of cryptographically secure, high-entropy passwords.

## 🛠️ Technology Stack

- **Frontend**: Next.js (TypeScript) + Tailwind CSS + Lucide Icons
- **Cryptography**: Libsodium (Sumo Edition)
- **Backend**: Next.js API Routes (Serverless Architecture)
- **Database**: JSON-based Adapter (Can be scaled to SQLite/PostgreSQL)
- **PDF Generation**: jsPDF

## 📦 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file (if not present) for any external configurations.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to start.

## 🔐 Security Philosophy

This project is built on the principle of **Distrust by Design**. 
1. The server is assumed to be compromised.
2. The database is assumed to be public.
3. **The Data is still safe** because only the client holds the keys.

---

## 📖 Documentation
- [User Verification Guide](./VERIFICATION_GUIDE.md) - How to test and verify the security yourself.
- [Security Walkthrough](file:///C:/Users/khate/.gemini/antigravity/brain/a8a94d6a-92e4-41c4-805e-b474911d8a66/walkthrough.md) - Technical implementation details.
