# metamask_ic

Example project to explore signing Internet Computer calls with Metamask.

## How to run?

```bash
cd metamask_ic/
npm install
npm run patch-agent
dfx start --background --clean
dfx deploy metamask_ic_backend
npm run start
```

Point your browser to http://localhost:8080 and check the console.

## What's happening

- When clicking on "Login with Metamask", we ask MetaMask for a signature on some message. We use the signature to recover the ECDSA public key of the MetaMask account.
- We use `@dfinity/identity-secp256k1` to convert the public to DER format and to compute the principal.
- When clicking on "Click me!", we prepare a call to the backend canister using a patched version of `@dfinity/agent`.
- We then calculate the `requestId` and let MetaMask sign `sha256(concat(domainSeparator, requestId))`
- We set `sender_pubkey` to the DER public key and `sender_sig` to the signature (after transforming it to a byte array)
- Then we use the patched `@dfinity/agent` to submit the request.

# Issue

Currently, the ingress validator doesn't accept the signature, e.g


```
  Code: 403 (Forbidden)
  Body: Failed to authenticate request 0xd37d3bb9cd4319cb8adb8d31e5cdfce455dd4ba6a8b98b447c26262a79f8ca9b due to: Invalid signature: Invalid basic signature: EcdsaSecp256k1 signature could not be verified: public key 046c0d2f36e02d0a146c23c542108c2d584b1fb5b8b4cbda2f6673b97622438267af48ec70019c533be54a49c2c3cf7befbd094d3af799a35c2e31dcb350983ab5, signature a7d8bd1fa0e67fcf27aa952b8cc27febda6419c18706aef6970b1b22f62678923a4857d1f4d62ea606b829192c6dbbd03607713413b1b51b59df509d0f4db586, error: verification failed
  Retrying request.
_
```