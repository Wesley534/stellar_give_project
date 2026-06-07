import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signTransaction } from "@stellar/freighter-api";

import {
  buildDeposit,
  buildTokenApprove,
  buildWithdraw,
  getContractMetadata,
  prepareDepositFlow,
  submitSignedTransaction,
  fundInvestorTokens,
  type ContractCallEnvelope,
} from "../api/services/contract";
import {
  getInvestorActivity,
  getInvestorDeposits,
  getInvestorEarnings,
  getInvestorPosition,
  getPoolInfo,
  recordContractTokenDeposit,
  type InvestorActivityRecord,
  type InvestorDepositRecord,
  type InvestorEarningsResponse,
  type InvestorPositionResponse,
  type PoolResponse,
} from "../api/services/pool";

export interface PoolInfo {
  totalLiquidity: number;
  availableLiquidity: number;
  totalShares: number;
  totalLoans: number;
  totalInterestEarned: number;
  totalPlatformFees: number;
  outstandingPrincipal: number;
  sharePrice: number;
}

export interface InvestorPosition {
  shares: number;
  totalShares: number;
  sharePercent: number;
  currentValue: number;
  deposited: number;
  earnedInterest: number;
}

export interface InvestorEarnings {
  walletAddress: string;
  estimatedWithdrawableAmount: number;
  yieldPercentage: number;
}

export interface InvestorDepositHistoryItem {
  id: string;
  sourceType: string;
  sourceAmount: number;
  tokenAmount: number;
  sharesReceived: number;
  transactionHash?: string | null;
  createdAt: string;
}

export interface InvestorActivityItem {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  sourceType: string | null;
  tokenAmount: number;
  sharesAmount: number;
  transactionHash?: string | null;
  createdAt: string;
}

function mapPool(pool?: PoolResponse): PoolInfo {
  return {
    totalLiquidity: pool?.totalLiquidity ?? 0,
    availableLiquidity: pool?.availableLiquidity ?? 0,
    totalShares: pool?.totalShares ?? 0,
    totalLoans: pool?.activeFinancingCount ?? 0,
    totalInterestEarned: pool?.totalInterestEarned ?? 0,
    totalPlatformFees: pool?.totalPlatformFees ?? 0,
    outstandingPrincipal: pool?.outstandingPrincipal ?? 0,
    sharePrice: pool?.sharePrice ?? 1,
  };
}

function mapPosition(position?: InvestorPositionResponse, totalShares = 0): InvestorPosition {
  return {
    shares: position?.sharesOwned ?? 0,
    totalShares,
    sharePercent: position?.poolSharePercentage ?? 0,
    currentValue: position?.currentValue ?? 0,
    deposited: position?.depositedAmount ?? 0,
    earnedInterest: position?.earnedInterest ?? 0,
  };
}

function mapEarnings(earnings?: InvestorEarningsResponse): InvestorEarnings {
  return {
    walletAddress: earnings?.walletAddress ?? "",
    estimatedWithdrawableAmount: earnings?.estimatedWithdrawableAmount ?? 0,
    yieldPercentage: earnings?.yieldPercentage ?? 0,
  };
}

function mapDeposits(deposits?: InvestorDepositRecord[]): InvestorDepositHistoryItem[] {
  return (deposits ?? []).map((deposit) => ({
    id: deposit.id,
    sourceType: deposit.sourceType,
    sourceAmount: deposit.sourceAmount,
    tokenAmount: deposit.tokenAmount,
    sharesReceived: deposit.sharesReceived,
    transactionHash: deposit.transactionHash,
    createdAt: deposit.createdAt,
  }));
}

function mapActivity(activity?: InvestorActivityRecord[]): InvestorActivityItem[] {
  return (activity ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type,
    sourceType: entry.sourceType,
    tokenAmount: entry.tokenAmount,
    sharesAmount: entry.sharesAmount,
    transactionHash: entry.transactionHash,
    createdAt: entry.createdAt,
  }));
}

async function signAndSubmitBuiltTransaction(
  action: ContractCallEnvelope<string>["data"],
  networkPassphrase: string,
  walletAddress: string,
) {
  if (typeof action.output !== "string" || !action.output) {
    throw new Error(`Missing transaction XDR for ${action.function}.`);
  }

  console.log('[usePool] signAndSubmitBuiltTransaction: built XDR', {
    function: action.function,
    xdrLength: action.output.length,
    xdrPreview: action.output.slice(0, 32),
  });

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

  console.log('[usePool] signAndSubmitBuiltTransaction: signed XDR', {
    function: action.function,
    signedLength: signed.signedTxXdr.length,
    signedPreview: signed.signedTxXdr.slice(0, 32),
  });

  // Detailed diagnostic logs before submission
  const signedXdr = signed.signedTxXdr;
  console.log("signedXdr typeof:", typeof signedXdr);
  console.log("signedXdr length:", signedXdr?.length);
  console.log("signedXdr preview:", signedXdr?.slice(0, 50));
  console.log("[usePool] submitting signed transaction to backend");

  return submitSignedTransaction(signedXdr);
}

export function usePool() {
  const queryClient = useQueryClient();

  const poolQuery = useQuery({
    queryKey: ["pool-info"],
    queryFn: getPoolInfo,
  });

  const positionQuery = useQuery({
    queryKey: ["pool-position"],
    queryFn: getInvestorPosition,
  });

  const earningsQuery = useQuery({
    queryKey: ["pool-earnings"],
    queryFn: getInvestorEarnings,
  });

  const depositsQuery = useQuery({
    queryKey: ["pool-deposits"],
    queryFn: getInvestorDeposits,
  });

  const activityQuery = useQuery({
    queryKey: ["pool-activity"],
    queryFn: getInvestorActivity,
  });

  const contractMetadataQuery = useQuery({
    queryKey: ["contract-metadata"],
    queryFn: getContractMetadata,
  });

  const pool = mapPool(poolQuery.data?.data?.data);
  const position = mapPosition(positionQuery.data?.data?.data, pool.totalShares);
  const earnings = mapEarnings(earningsQuery.data?.data?.data);
  const deposits = mapDeposits(depositsQuery.data?.data?.data?.deposits);
  const activity = mapActivity(activityQuery.data?.data?.data?.activity);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pool-info"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-position"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-earnings"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-deposits"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["contract-pool"] }),
      queryClient.invalidateQueries({ queryKey: ["contract-metadata"] }),
    ]);
  };

  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      const walletAddress = earnings.walletAddress;
      const metadata = contractMetadataQuery.data?.data?.data;

      console.log('[usePool] deposit flow start', {
        amount,
        walletAddress,
        network: metadata?.network,
        contractId: metadata?.contractId,
      });

      if (!walletAddress) {
        throw new Error("Connect and sync your wallet before depositing.");
      }

      if (!metadata?.networkPassphrase) {
        throw new Error("Contract network metadata is unavailable.");
      }

      const flow = await prepareDepositFlow(amount);
      const steps = flow.data.data;
      console.log('[usePool] deposit flow prepared', {
        fundingRequired: steps.fundingRequired,
        autoFundingAvailable: steps.autoFundingAvailable,
        trustlineRequired: steps.trustline !== null,
        tokenBalance: steps.tokenBalance,
      });

      if (steps.trustline) {
        console.log('[usePool] deposit flow trustline required, submitting trustline transaction');
        await signAndSubmitBuiltTransaction(
          steps.trustline,
          metadata.networkPassphrase,
          walletAddress,
        );
      }

      if (steps.fundingRequired) {
        console.log('[usePool] deposit flow funding required', {
          amount,
          tokenBalance: steps.tokenBalance,
          autoFundingAvailable: steps.autoFundingAvailable,
        });

        if (!steps.autoFundingAvailable) {
          throw new Error(
            "Your wallet is connected and can create the IFX trustline, but automatic IFX funding is not configured yet. Ask the platform admin to fund your wallet with IFX, then retry the deposit.",
          );
        }

        const fundingShortfall = Math.max(0, amount - steps.tokenBalance);
        await fundInvestorTokens(fundingShortfall || amount);
        console.log('[usePool] deposit flow funding completed');
      }

      const approveBuild = await buildTokenApprove(amount);
      console.log('[usePool] deposit flow approval built', { function: approveBuild.data.data.function });
      await signAndSubmitBuiltTransaction(
        approveBuild.data.data,
        metadata.networkPassphrase,
        walletAddress,
      );

      const depositBuild = await buildDeposit(amount);
      console.log('[usePool] deposit flow deposit built', { function: depositBuild.data.data.function });
      const depositSubmission = await signAndSubmitBuiltTransaction(
        depositBuild.data.data,
        metadata.networkPassphrase,
        walletAddress,
      );

      console.log('[usePool] deposit flow completed', {
        transactionHash: depositSubmission.data.data.hash,
      });

      await recordContractTokenDeposit({
        tokenAmount: amount,
        transactionHash: depositSubmission.data.data.hash,
      });

      return {
        flow: steps,
        depositSubmission: depositSubmission.data.data,
      };
    },
    onSuccess: refresh,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (shareAmount: number) => buildWithdraw(shareAmount),
    onSuccess: refresh,
  });

  return {
    pool,
    position,
    earnings,
    deposits,
    activity,
    poolQuery,
    positionQuery,
    earningsQuery,
    depositsQuery,
    activityQuery,
    contractMetadataQuery,
    deposit: depositMutation.mutateAsync,
    withdraw: withdrawMutation.mutateAsync,
    depositMutation,
    withdrawMutation,
  };
}
