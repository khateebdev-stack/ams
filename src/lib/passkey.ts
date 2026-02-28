import {
    startRegistration,
    startAuthentication,
} from '@simplewebauthn/browser';
import { CryptoService } from './crypto';

/**
 * Initiates Passkey Registration
 */
export async function registerPasskey(vaultKey?: Uint8Array, token?: string) {
    // 1. Get registration options from server
    const optionsRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
    });
    const options = await optionsRes.json();

    if (options.error) throw new Error(options.error);

    // 2. Start registration with the authenticator
    const prfExtension = {
        prf: {
            eval: {
                first: new Uint8Array(32).fill(1).buffer,
            },
        },
    };

    const regResponse = await startRegistration({
        ...options,
        extensions: {
            ...options.extensions,
            ...prfExtension,
        },
    });

    // 3. Extract PRF output and wrap VaultKey if provided
    let wrappedKey = null;
    const prfOutput = (regResponse.clientExtensionResults as any)?.prf?.results?.first;

    if (vaultKey && prfOutput) {
        wrappedKey = await CryptoService.wrapKeyWithHardware(vaultKey, new Uint8Array(prfOutput));
    }

    // 4. Send registration response to server for verification
    const verificationRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            ...regResponse,
            wrappedKey // Bind the hardware-wrapped key to this credential
        }),
    });

    const verification = await verificationRes.json();

    if (!verification.verified) throw new Error('Passkey verification failed');

    return verification;
}

/**
 * Initiates Passkey Authentication
 */
export async function authenticatePasskey() {
    // 1. Get authentication options from server
    const optionsRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    const optionsText = await optionsRes.text();
    let options;
    try {
        options = JSON.parse(optionsText);
    } catch (e) {
        console.error("Failed to parse options response as JSON. Raw response:", optionsText);
        throw new Error("Server returned an invalid response when requesting login options.");
    }

    if (options.error) throw new Error(options.error);

    // 2. Start authentication with the authenticator
    // Request PRF output
    const prfExtension = {
        prf: {
            eval: {
                first: new Uint8Array(32).fill(1).buffer,
            },
        },
    };

    let authResponse;
    try {
        authResponse = await startAuthentication({
            optionsJSON: {
                ...options,
                extensions: {
                    ...options.extensions,
                    ...prfExtension,
                },
            }
        });
    } catch (e: any) {
        if (e.name === 'NotAllowedError') {
            throw new Error('Passkey login was cancelled or no matching authenticator found on this device.');
        }
        throw e;
    }

    // 3. Send authentication response to server for verification
    const verificationRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResponse),
    });

    const verificationText = await verificationRes.text();
    let verification;
    try {
        verification = JSON.parse(verificationText);
    } catch (e) {
        console.error("Failed to parse verification response as JSON. Raw response:", verificationText);
        throw new Error("Server returned an invalid response during passkey verification.");
    }

    if (!verificationRes.ok || !verification.verified) {
        throw new Error(verification.error || 'Passkey authentication failed');
    }

    // Extract PRF output if available
    const prfOutput = (authResponse.clientExtensionResults as any)?.prf?.results?.first;

    return {
        ...verification,
        prfOutput: prfOutput ? new Uint8Array(prfOutput) : null
    };
}
