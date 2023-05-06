import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Contract, Signer, ethers } from "ethers";
import { useState } from "react";
import { createSessionKeySigner } from "@zerodevapp/sdk";
import { SessionSigner } from "@zerodevapp/sdk/dist/src/session/SessionSigner";

export default function Address() {
  const router = useRouter();
  const { isReady, query } = router;
  const { data: session, status } = useSession();

  const [sessionKey, setSessionKey] = useState<{
    privateSigner: Signer;
    sessionJWT: string;
  }>();
  const [sessionError, setSessionError] = useState<Error>();

  return (
    <div>
      <h3>Smart Contract Wallet: {query.address}</h3>
      <button
        onClick={async () => {
          const privateSigner = ethers.Wallet.createRandom();
          const address = await privateSigner.getAddress();
          await fetch(`/api/4337/${query.address}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionPublicKey: address,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                throw "Failed to create session key";
              }
              setSessionError(undefined);

              const json = await res.json();
              console.debug({ sessionKey });
              setSessionKey({
                privateSigner,
                sessionJWT: json.data.sessionKey,
              });
            })
            .catch((err) => {
              console.error(err);
              setSessionError(err);
            });
        }}
      >
        Create Session Key
      </button>

      {sessionError && <p>{sessionError.message}</p>}

      {sessionKey && (
        <>
          <div>
            <p>Session Key:</p>
            <p>{sessionKey.sessionJWT}</p>
          </div>
          <div>
            <button
              onClick={async () => {
                const sessionKeySigner = await createSessionKeySigner({
                  sessionKeyData: sessionKey.sessionJWT,
                  privateSigner:
                    sessionKey.privateSigner as unknown as SessionSigner,
                  projectId: process.env.ZERO_DEV_PROJECT_ID!,
                });
                const contractAddress =
                  "0xcA171d43B2f5e5c1a071d3Dba8354eF0E2df4816";
                const contractABI = [
                  "function mint(address _to) public",
                  "function balanceOf(address owner) external view returns (uint256 balance)",
                ];
                const nftContract = new Contract(
                  contractAddress,
                  contractABI,
                  sessionKeySigner as unknown as Signer
                );
                const toAddress = await sessionKey.privateSigner.getAddress();
                const receipt = await nftContract.mint(toAddress);
                await receipt.wait();
                console.log(
                  `NFT balance: ${await nftContract.balanceOf(toAddress)}`
                );
              }}
            >
              Mint NFT to Wallet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
