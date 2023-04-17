import { Actor, HttpAgent, requestIdOf, concat, fromHex, toHex, hash, polling } from "@dfinity/agent";
import { Delegation, DelegationChain, DelegationIdentity, Ed25519KeyIdentity } from "@dfinity/identity";
import { Secp256k1PublicKey} from "@dfinity/identity-secp256k1";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import { canisterId, idlFactory } from "../../declarations/metamask_ic_backend";

// Define gloabl variables 

const domainSeparator = new TextEncoder().encode('\x0Aic-request');
const DelegationDomainSeparator = new TextEncoder().encode('\x1Aic-request-auth-delegation');


let pubKey;
let pubKeyDer;
let mmPrincipal;
let accounts;
let backend;

let agent = new HttpAgent();


// Get public key of Metamask account by recovering it from the signature of a message
async function getPublicKey() {

  document.getElementById("greeting").innerText = "Asking MetaMask to sign a message to recover public key...";

  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const signer = provider.getSigner();
  const message = 'Get Public Key';
  const signature = await signer.signMessage(message);
  const digest = ethers.utils.arrayify(ethers.utils.hashMessage(message));
  const publicKey = await ethers.utils.recoverPublicKey(digest, signature);
  console.log('publicKey', publicKey);
  return publicKey;
};


async function createDelegationIdentity() {

  document.getElementById("greeting").innerText = "Asking MetaMask to sign a delegation for a session key...";


  const sessionIdentity = Ed25519KeyIdentity.generate();
  const sessionPubKey = sessionIdentity.getPublicKey();
  const targets = [Principal.fromText(canisterId)];
  const delegation = new Delegation(
    sessionPubKey.toDer(),
    BigInt(new Date(Date.now() + 15 * 60 * 1000)) * BigInt(1000000), // In nanoseconds.
    targets,
  );

  const msg = new Uint8Array([
    ...DelegationDomainSeparator,
    ...new Uint8Array(requestIdOf(delegation)),
  ]);
  const hashed_msg = hash(msg);

  let signature = await ethereum.request({
    method: 'eth_sign',
    params: [accounts[0], '0x'+toHex(hashed_msg)],
  });

  // Strip v value (last byte) from signature
  signature = signature.slice(0, -2);
  signature = signature.slice(2);

  signature = fromHex(signature);

  const delegationChain = new DelegationChain([{ delegation, signature }], pubKeyDer);

  return DelegationIdentity.fromDelegation(sessionIdentity, delegationChain);
}

async function signRequest(request) {

  const requestId = await requestIdOf(request);
  
  document.getElementById("greeting").innerText = "Asking MetaMask to sign request: " + toHex(requestId);

  // Prepare message to sign
  const msg = concat(domainSeparator, requestId);
  const hashed_msg = hash(msg);

  let signature = await ethereum.request({
    method: 'eth_sign',
    params: [accounts[0], '0x'+toHex(hashed_msg)],
  });

  // Strip v value (last byte) from signature
  signature = signature.slice(0, -2);
  signature = signature.slice(2);
  
  return {
    content: request,
    sender_pubkey: pubKeyDer,
    sender_sig: fromHex(signature),
  }

}

// Fetch root key for certificate validation during development
if (process.env.DFX_NETWORK !== "ic") {
  agent.fetchRootKey().catch((err) => {
    console.warn(
      "Unable to fetch root key. Check to ensure that your local replica is running"
    );
    console.error(err);
  });
}

document.querySelector("#login_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  console.log("login");

  accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  pubKey = await getPublicKey();
  pubKey = ethers.utils.arrayify(pubKey);
  let key = Secp256k1PublicKey.fromRaw(pubKey);
  pubKeyDer = key.toDer();
  mmPrincipal = Principal.selfAuthenticating(new Uint8Array(pubKeyDer));

  document.getElementById("greeting").innerText = "The principal of your MetaMask account is: " + mmPrincipal.toText() + "";

});

document.querySelector("#session_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const delegationIdentity = await createDelegationIdentity();

  document.getElementById("greeting").innerText = "Session created";


  console.log(delegationIdentity);

  agent = new HttpAgent({ identity: delegationIdentity });
  if (process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === undefined) {
    await agent.fetchRootKey();
  };
  backend = Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });

});


// document.querySelector("#alt_session_form").addEventListener("submit", async (e) => {
//   e.preventDefault();

//   const sessionIdentity = Ed25519KeyIdentity.generate();

//   const provider = new ethers.providers.Web3Provider(window.ethereum);



//   signer = await provider.getSigner();

//   const domain = {
//     name: 'metamask-ic'
//   };

//   const types = {
//     Delegation: [
//       { name: 'SessionKey', type: 'string' },
//     ]
//   };

//   const value = {
//     SessionKey: toHex(sessionIdentity.getPublicKey())
//   };

//   const signature = await signer._signTypedData(domain, types, value);

//   document.getElementById("greeting").innerText = "The principal of your MetaMask account is: " + mmPrincipal.toText() + "";

// });


document.querySelector("#greeting_form").addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("greeting")
  const button = e.target.querySelector("button");

  const name = document.getElementById("name").value.toString();

  button.setAttribute("disabled", true);


  if (backend) {

    try {

      const result = await backend.greet(name);
      document.getElementById("greeting").innerText = JSON.stringify(result);

    } catch(e) {
      console.log(e);
    } finally {
      button.removeAttribute("disabled");
    }

   

  } else {

    // Prepare an unsigned request
  let arg = new Uint8Array(IDL.encode([IDL.Text], [name]));
  const req = await agent.prepareCallRequest(canisterId, { methodName: "greet", arg }, mmPrincipal);
  const request = req.body; 
  console.log("----------REQUEST----------");
  console.log(request);

  req.body = await signRequest(request);

  console.log(req);

  try {
    const {requestId, response} = await agent.submitRequest(req);
    console.log(response);
    document.getElementById("greeting").innerText = JSON.stringify(response);
    const res = await fetchResponse(requestId);
    document.getElementById("greeting").innerText = res;

  } catch (error) {
    console.log(error);
  } finally {
    button.removeAttribute("disabled");
  }

  }

  return false;
});


async function fetchResponse(requestId) {

  const path = [new TextEncoder().encode('request_status'), requestId];
  const rsRequest = await agent.createReadStateRequest({ paths: [path] });
  
  rsRequest.body.content.sender = mmPrincipal;

  rsRequest.body = await signRequest(rsRequest.body.content);

  const responseBytes = await polling.pollForResponse(agent, canisterId, requestId, polling.defaultStrategy, rsRequest);

  return IDL.decode([IDL.Text], responseBytes);

}
