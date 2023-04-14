import { HttpAgent, requestIdOf, concat } from "@dfinity/agent";
import { Secp256k1PublicKey} from "@dfinity/identity-secp256k1";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import sha256 from 'crypto-js/sha256';
import { canisterId } from "../../declarations/metamask_ic_backend";

// Define gloabl variables 

const domainSeparator = new TextEncoder().encode('\x0Aic-request');

let pubKey;
let pubKeyDer;
let mmPrincipal;
let accounts;

const agent = new HttpAgent();


// Get public key of Metamask account by recovering it from the signature of a message
async function getPublicKey() {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const signer = provider.getSigner();
  const message = 'Get Public Key';
  const signature = await signer.signMessage(message);
  const digest = ethers.utils.arrayify(ethers.utils.hashMessage(message));
  const publicKey = await ethers.utils.recoverPublicKey(digest, signature);
  console.log('publicKey', publicKey);
  return publicKey;
};

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

  console.log(mmPrincipal);

});


document.querySelector("#greeting_form").addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("greeting")
  const button = e.target.querySelector("button");

  const name = document.getElementById("name").value.toString();

  button.setAttribute("disabled", true);


  // Prepare an unsigned request
  let arg = new Uint8Array(IDL.encode([IDL.Text], [name]));
  const req = await agent.prepareCallRequest(canisterId, { methodName: "greet", arg }, mmPrincipal);
  const request = req.body; 
  console.log("----------REQUEST----------");
  console.log(request);
  const requestId = await requestIdOf(request);
  console.log("----------REQUEST ID----------");
  console.log(requestId);
  console.log(Buffer.from(requestId).toString('hex'));

  // Prepare message to sign
  const msg = concat(domainSeparator, requestId);
  const hash = sha256(msg).toString();
 
  let signature = await ethereum.request({
    method: 'eth_sign',
    params: [accounts[0], '0x'+hash.toString()],
  });


  // Strip v value (last byte) from signature
  signature = signature.slice(0, -2);
  console.log("----------SIGNATURE----------");
  console.log(signature);

  const signedRequest = {
    content: request,
    sender_pubkey: pubKeyDer,
    sender_sig: ethers.utils.arrayify(signature),
  }

  console.log(signedRequest);

  req.body = signedRequest;

  try {
    const response = await agent.submitRequest(req);
    console.log(response);
    document.getElementById("greeting").innerText = response;
  } catch (error) {
    console.log(error);
  } finally {
    button.removeAttribute("disabled");
  }

  return false;
});
