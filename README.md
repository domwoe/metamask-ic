# metamask_ic

Example project to explore signing Internet Computer calls with Metamask.

You need to have the MetaMask browser extension installed, and you need to have `Toggle eth_sign requests` activated. You can find this setting in `settings > advanced` to the bottom.

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
- We remove the last byte from the signature, as the Internet Computer expects a 64-byte signature without the recovery byte.
- We set `sender_pubkey` to the DER public key and `sender_sig` to the signature (after transforming it to a byte array)
- Then we use the patched `@dfinity/agent` to submit the request.