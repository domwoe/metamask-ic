# metamask_ic

Example project to explore signing Internet Computer calls with Metamask.
The project supports two types of modes:

- **Direct Mode**: The user signs the request directly with MetaMask. This requires the user to approve every request. Since the Internet Computer requires authentication for readState requests multiple requests have to be signed per update call.
- **Session Mode**: The user creates a session key pair and asks MetaMask to sign a delegation.

You can check out the deployed [demo](https://4n2mr-ryaaa-aaaap-qba5q-cai.ic0.app/).
## Prerequisites
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
- We use `@dfinity/identity-secp256k1` to convert the public to DER format and compute the principal.
- When clicking on "Click me!", we prepare a call to the backend canister using a patched version of `@dfinity/agent`.
- We then calculate the `requestId` and let MetaMask sign `sha256(concat(domainSeparator, requestId))`
- We remove the last byte from the signature, as the Internet Computer expects a 64-byte signature without the recovery byte.
- We set `sender_pubkey` to the DER public key and `sender_sig` to the signature (after transforming it to a byte array)
- Then we use the patched `@dfinity/agent` to submit the request.
- If you click on "Create session", then we create a new session key pair and ask MetaMask to sign the delegation. We then initiate a new actor with this `DelegationIdentity` and use it to call the backend canister.


## ToDos

- [ ] Fix `TypeError: Failed to execute 'fetch' on 'Window': Request with GET/HEAD method cannot have body.` for `readState` requests.
- [ ] Decoding of response bytes.
- [ ] Clean up code and nicer UI.
- [ ] Add demonstration of Sign-In with Ethereum (SIWE) pattern, similar to [SIWE AuthZ example](https://github.com/domwoe/siwe_authz).
