# Axiom Audit Policy: Accountability without Exposure

Axiom implements a strictly structured **Security Audit Engine** designed to provide administrators and users with a clear record of sensitive events while strictly adhering to our **Zero-Knowledge** architecture.

## 1. Core Principles

- **Event, Not Content**: We log that an event occurred (e.g., "Secret Copied"), but we never log the data itself or its plaintext metadata.
- **Anonymized Metadata**: Any metadata stored in audit logs is either encrypted at rest or anonymized to prevent correlation attacks.
- **Client-Side Triggering**: Most audit events are triggered from the client after successful local cryptographic verification.

## 2. Tracked Events

The following high-assurance events are tracked by the system:

| Event ID | Description | Security Significance |
| :--- | :--- | :--- |
| `LOGIN_SUCCESS` | Successful vault unlock | Boundary of local key release |
| `LOGIN_FAILURE` | Failed attempt to derive keys | Indicator of brute-force/guess attempts |
| `VAULT_CREATED` | New cryptographic compartment initialized | New blast radius domain created |
| `PASSWORD_VIEWED` | Contextual decryption of a record | Sensitive data exposure point |
| `PASSWORD_COPIED` | Transfer of decrypted string to clipboard | External data movement |
| `RECOVERY_USED` | Account recovery flow initiated | Emergency key derivation trigger |
| `2FA_ENROLLED` | Multi-factor protection activated | Security level elevation |

## 3. Data Structure

Each audit log entry contains:
- **Timestamp**: ISO-8601 UTC timestamp.
- **UserId**: Unique identifier of the vault owner.
- **Action**: Event identifier from the table above.
- **Network Context**: Anonymized IP address and User-Agent (used for device trust verification).
- **Metadata**: Encrypted references (e.g., the encrypted ID of the record accessed).

## 4. Log Integrity

In production environments, audit logs are stored in a write-once-read-many (WORM) compatible format or signed to prevent tampering. Any deletion of audit logs is itself a high-severity auditable event.

## 5. User Visibility

Vault owners can view their latest audit logs directly from the **Axiom Settings** dashboard. This empowers users to detect unauthorized access attempts or suspicious patterns on their own account.
