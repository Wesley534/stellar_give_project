import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface WalletContextType {
  walletAddress: string | null
  isConnected: boolean
  network: string
  balance: number
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | null>(null)

const MOCK_ADDRESS = 'GDXYZ7K3ABCDEF8UVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXY'

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [balance] = useState(25000)

  useEffect(() => {
    const stored = localStorage.getItem('stellar_wallet')
    if (stored) {
      setWalletAddress(stored)
      setIsConnected(true)
    }
  }, [])

  const connect = async () => {
    // Simulate Freighter wallet connection delay
    await new Promise(r => setTimeout(r, 1200))
    setWalletAddress(MOCK_ADDRESS)
    setIsConnected(true)
    localStorage.setItem('stellar_wallet', MOCK_ADDRESS)
  }

  const disconnect = () => {
    setWalletAddress(null)
    setIsConnected(false)
    localStorage.removeItem('stellar_wallet')
  }

  return (
    <WalletContext.Provider value={{
      walletAddress, isConnected, network: 'testnet', balance, connect, disconnect
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
