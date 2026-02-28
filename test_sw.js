const { verifyAuthenticationResponse } = require('@simplewebauthn/server');

const options = {
    response: {
        id: "oBZq5wPZAVN55yQleYkAxg",
        rawId: "oBZq5wPZAVN55yQleYkAxg",
        type: "public-key",
        clientExtensionResults: {},
        response: {
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiWDFZZmRyRU1zSWRoMjMweE5xR0J5c3NBT3lEMXItNWNjSWMxNWZ2RkU1TSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
            authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MBAAAAMQ",
            signature: "MEUCIQCH80cE6K2jS-3w0I1Uj9c0Wp2E8_xKz_8qM8s3i_c7XwIgH-o_A3PzT9c2-552Vn3k6E-c5-f86_d89YyS7y3R8-k"
        }
    },
    expectedChallenge: "X1YfdrEMsIdh230xNqGByssAOyD1r-5ccIc15fvFE5M",
    expectedOrigin: "http://localhost:3000",
    expectedRPID: "localhost",
    credential: {
        id: "oBZq5wPZAVN55yQleYkAxg",
        publicKey: new Uint8Array(Buffer.from("pQECAyYgASFYIP7J1pJHXUnZAbop8Xs3OL6sQYQCqewOyE5OsJEOw5ePIlggKn4F41AKCbwsE/3LhC9uL7ou76yWNEjKZ0H0U1b7rAs=", 'base64')),
        counter: 0,
        transports: ["hybrid", "internal"]
    }
};

verifyAuthenticationResponse(options).then(console.log).catch(console.error);
