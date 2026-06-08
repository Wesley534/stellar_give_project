import { signTransaction } from "@stellar/freighter-api";
import {
  submitSignedTransaction,
  type ContractCallEnvelope,
} from "../api/services/contract";

export async function signAndSubmitBuiltTransaction(
  action: ContractCallEnvelope<string>["data"],
  networkPassphrase: string,
  walletAddress: string,
) {
  if (typeof action.output !== "string" || !action.output) {
    throw new Error(`Missing transaction XDR for ${action.function}.`);
  }

  const signed = await signTransaction(action.output, {
    address: walletAddress,
    networkPassphrase,
  });

  if (signed.error || !signed.signedTxXdr) {
    throw new Error(
      typeof signed.error === "string"
        ? signed.error
        : signed.error?.message || `Freighter could not sign ${action.function}.`,
    );
  }

  return submitSignedTransaction(signed.signedTxXdr);
}
