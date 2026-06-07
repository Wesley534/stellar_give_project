export {};

declare global {
  interface Window {
    freighterApi?: {
      isConnected?: () => Promise<{ isConnected: boolean; error?: string }>;
      requestAccess?: () => Promise<{ address: string; error?: string }>;
      getAddress?: () => Promise<{ address: string; error?: string }>;
      getNetwork?: () => Promise<{
        network: string;
        networkPassphrase: string;
        error?: string;
      }>;
    };
  }
}
