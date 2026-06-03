import { useState } from 'react'

export type FinancingStatus = 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'BORROWED' | 'REPAID' | 'REJECTED' | 'CLOSED'

export interface FinancingRequest {
  id: string
  borrowerName: string
  walletAddress: string
  invoiceNumber: string
  invoiceAmount: number
  borrowAmount: number
  repaymentAmount: number
  dueDate: string
  status: FinancingStatus
  description: string
  createdAt: string
}

const INITIAL_REQUESTS: FinancingRequest[] = [
  {
    id: 'FR-001',
    borrowerName: 'Savanna Tech Ltd',
    walletAddress: 'GDABC1234567890EFGHIJKLMNOPQRSTUVWXYZ',
    invoiceNumber: 'INV-2024-001',
    invoiceAmount: 10000,
    borrowAmount: 8000,
    repaymentAmount: 8800,
    dueDate: '2024-09-30',
    status: 'PENDING_ADMIN_REVIEW',
    description: 'Invoice for software development services delivered to client.',
    createdAt: '2024-06-01',
  },
  {
    id: 'FR-002',
    borrowerName: 'Nairobi Logistics Co.',
    walletAddress: 'GBXYZ9876543210ABCDEFGHIJKLMNOPQRSTUVW',
    invoiceNumber: 'INV-2024-002',
    invoiceAmount: 25000,
    borrowAmount: 20000,
    repaymentAmount: 22000,
    dueDate: '2024-10-15',
    status: 'APPROVED',
    description: 'Outstanding invoice from transport and logistics contract.',
    createdAt: '2024-05-28',
  },
  {
    id: 'FR-003',
    borrowerName: 'Mombasa Traders',
    walletAddress: 'GCDEF5432109876GHIJKLMNOPQRSTUVWXYZABC',
    invoiceNumber: 'INV-2024-003',
    invoiceAmount: 15000,
    borrowAmount: 12000,
    repaymentAmount: 13200,
    dueDate: '2024-08-31',
    status: 'BORROWED',
    description: 'Trade goods invoice pending collection from buyer.',
    createdAt: '2024-05-15',
  },
  {
    id: 'FR-004',
    borrowerName: 'Kisumu Farms',
    walletAddress: 'GDGHI9876012345JKLMNOPQRSTUVWXYZABCDE',
    invoiceNumber: 'INV-2024-004',
    invoiceAmount: 8000,
    borrowAmount: 6000,
    repaymentAmount: 6600,
    dueDate: '2024-07-31',
    status: 'REPAID',
    description: 'Agricultural produce invoice fully settled.',
    createdAt: '2024-04-20',
  },
  {
    id: 'FR-005',
    borrowerName: 'Eldoret Builders',
    walletAddress: 'GEJKL1122334455MNOPQRSTUVWXYZABCDEFGH',
    invoiceNumber: 'INV-2024-005',
    invoiceAmount: 5000,
    borrowAmount: 4000,
    repaymentAmount: 4400,
    dueDate: '2024-11-30',
    status: 'REJECTED',
    description: 'Invoice could not be verified. Request rejected.',
    createdAt: '2024-06-02',
  },
]

export function useFinancing() {
  const [requests, setRequests] = useState<FinancingRequest[]>(INITIAL_REQUESTS)

  const createRequest = (data: Omit<FinancingRequest, 'id' | 'status' | 'createdAt' | 'walletAddress' | 'borrowerName'>) => {
    const newReq: FinancingRequest = {
      ...data,
      id: `FR-00${requests.length + 1}`,
      borrowerName: 'My Business',
      walletAddress: 'GDXYZ7K3ABCDEF8UVWXYZ1234567890ABCDEF',
      status: 'PENDING_ADMIN_REVIEW',
      createdAt: new Date().toISOString().split('T')[0],
    }
    setRequests(prev => [newReq, ...prev])
    return newReq
  }

  const approve = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r))
  }

  const reject = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r))
  }

  const borrow = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'BORROWED' } : r))
  }

  const repay = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REPAID' } : r))
  }

  return { requests, createRequest, approve, reject, borrow, repay }
}
