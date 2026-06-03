import { useState } from 'react'

export interface PoolInfo {
  totalLiquidity: number
  availableLiquidity: number
  totalShares: number
  totalLoans: number
  totalInterestEarned: number
}

export interface PoolDeposit {
  id: string
  investorName: string
  walletAddress: string
  amount: number
  sharesReceived: number
  sharePercent: number
  depositDate: string
}

export interface InvestorPosition {
  shares: number
  totalShares: number
  sharePercent: number
  currentValue: number
  deposited: number
  earnedInterest: number
}

const INITIAL_POOL: PoolInfo = {
  totalLiquidity: 10800,
  availableLiquidity: 2800,
  totalShares: 10000,
  totalLoans: 1,
  totalInterestEarned: 800,
}

const INITIAL_DEPOSITS: PoolDeposit[] = [
  {
    id: 'DEP-001',
    investorName: 'Alice Kimani',
    walletAddress: 'GDXYZ7K3ABCDEF8UVWXYZ1234567890ABCDEF',
    amount: 5000,
    sharesReceived: 5000,
    sharePercent: 50,
    depositDate: '2024-05-01',
  },
  {
    id: 'DEP-002',
    investorName: 'Grace Wanjiku',
    walletAddress: 'GBWJK9L2MNOPQR3STUVWXY4Z567890ABCDEFG',
    amount: 5000,
    sharesReceived: 5000,
    sharePercent: 50,
    depositDate: '2024-05-02',
  },
]

export function usePool() {
  const [pool, setPool] = useState<PoolInfo>(INITIAL_POOL)
  const [deposits, setDeposits] = useState<PoolDeposit[]>(INITIAL_DEPOSITS)

  const deposit = async (amount: number, investorName: string, walletAddress: string) => {
    await new Promise(r => setTimeout(r, 1200))
    const newShares = amount
    const newDeposit: PoolDeposit = {
      id: `DEP-00${deposits.length + 1}`,
      investorName,
      walletAddress,
      amount,
      sharesReceived: newShares,
      sharePercent: Math.round((newShares / (pool.totalShares + newShares)) * 100),
      depositDate: new Date().toISOString().split('T')[0],
    }
    setDeposits(prev => [...prev, newDeposit])
    setPool(prev => ({
      ...prev,
      totalLiquidity: prev.totalLiquidity + amount,
      availableLiquidity: prev.availableLiquidity + amount,
      totalShares: prev.totalShares + newShares,
    }))
    return newDeposit
  }

  const withdraw = async (shareAmount: number) => {
    await new Promise(r => setTimeout(r, 1200))
    const valuePerShare = pool.totalLiquidity / pool.totalShares
    const withdrawValue = Math.floor(shareAmount * valuePerShare)
    setPool(prev => ({
      ...prev,
      totalLiquidity: Math.max(0, prev.totalLiquidity - withdrawValue),
      availableLiquidity: Math.max(0, prev.availableLiquidity - withdrawValue),
      totalShares: Math.max(0, prev.totalShares - shareAmount),
    }))
    return withdrawValue
  }

  const getInvestorPosition = (walletAddress: string): InvestorPosition => {
    const myDeposit = deposits.find(d => d.walletAddress === walletAddress)
    if (!myDeposit) return { shares: 0, totalShares: pool.totalShares, sharePercent: 0, currentValue: 0, deposited: 0, earnedInterest: 0 }
    const sharePercent = (myDeposit.sharesReceived / pool.totalShares) * 100
    const currentValue = Math.floor((myDeposit.sharesReceived / pool.totalShares) * pool.totalLiquidity)
    const earnedInterest = Math.max(0, currentValue - myDeposit.amount)
    return {
      shares: myDeposit.sharesReceived,
      totalShares: pool.totalShares,
      sharePercent,
      currentValue,
      deposited: myDeposit.amount,
      earnedInterest,
    }
  }

  return { pool, deposits, deposit, withdraw, getInvestorPosition }
}
