/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import {
  getAddress,
  getNetwork,
  isConnected as isFreighterConnected,
  requestAccess,
} from "@stellar/freighter-api";

import { connectWallet as connectWalletApi } from "../api/services/wallet";

type WalletNetwork = "TESTNET" | "MAINNET";

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: WalletNetwork;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WALLET_ADDRESS_KEY = "stellar_wallet";
const WALLET_NETWORK_KEY = "stellar_wallet_network";

const WalletContext = createContext<WalletContextType | null>(null);

function toBackendNetwork(network?: string): WalletNetwork {
  return network?.toUpperCase() === "PUBLIC" || network?.toUpperCase() === "MAINNET"
    ? "MAINNET"
    : "TESTNET";
}

async function requestFreighterConnection() {
  const connection = await isFreighterConnected();
  if (connection.error) {
    throw new Error(
      typeof connection.error === "string"
        ? connection.error
        : connection.error.message || "Freighter extension was not detected in this browser.",
    );
  }

  if (!connection.isConnected) {
    throw new Error("Freighter extension was not detected in this browser.");
  }

  let access = await getAddress();

  if (access.error || !access.address) {
    access = await requestAccess();
  }

  if (access.error || !access.address) {
    throw new Error(
      typeof access.error === "string"
        ? access.error
        : access.error?.message || "Freighter did not return a wallet address.",
    );
  }

  const networkResponse = await getNetwork();

  if (networkResponse.error) {
    throw new Error(
      typeof networkResponse.error === "string"
        ? networkResponse.error
        : networkResponse.error.message || "Freighter network lookup failed.",
    );
  }

  return {
    address: access.address,
    network: toBackendNetwork(networkResponse.network),
    extensionConnected: connection.isConnected,
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<WalletNetwork>("TESTNET");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const storedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
    const storedNetwork = localStorage.getItem(WALLET_NETWORK_KEY) as WalletNetwork | null;

    if (storedAddress) {
      setWalletAddress(storedAddress);
    }

    if (storedNetwork === "TESTNET" || storedNetwork === "MAINNET") {
      setNetwork(storedNetwork);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !walletAddress) {
      return;
    }

    void connectWalletApi({
      walletAddress,
      network,
    }).catch(() => {
      // Keep the local connection and let the requesting page surface API errors if sync fails.
    });
  }, [walletAddress, network]);

  const connect = async () => {
    setIsConnecting(true);

    try {
      const connection = await requestFreighterConnection();
      setWalletAddress(connection.address);
      setNetwork(connection.network);
      localStorage.setItem(WALLET_ADDRESS_KEY, connection.address);
      localStorage.setItem(WALLET_NETWORK_KEY, connection.network);

      const token = localStorage.getItem("token");
      if (token) {
        await connectWalletApi({
          walletAddress: connection.address,
          network: connection.network,
        });
      }

      toast.success("Freighter wallet connected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect Freighter wallet.";
      toast.error(message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
    setNetwork("TESTNET");
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    localStorage.removeItem(WALLET_NETWORK_KEY);
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected: Boolean(walletAddress),
        isConnecting,
        network,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
