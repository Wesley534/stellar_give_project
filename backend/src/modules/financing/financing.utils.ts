import { ADVANCE_RATE_BPS, INTEREST_RATE_BPS, PROCESSING_FEE_BPS } from './financing.constants'

export function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

export function calculateFinancingTerms(invoiceAmount: number) {
  const grossBorrowAmount = roundMoney((invoiceAmount * ADVANCE_RATE_BPS) / 10000)
  const interestAmount = roundMoney((grossBorrowAmount * INTEREST_RATE_BPS) / 10000)
  const processingFeeAmount = roundMoney(
    (grossBorrowAmount * PROCESSING_FEE_BPS) / 10000,
  )
  const expectedSettlementAmount = roundMoney(
    grossBorrowAmount + interestAmount + processingFeeAmount,
  )

  return {
    grossBorrowAmount,
    advanceRateBps: ADVANCE_RATE_BPS,
    interestRateBps: INTEREST_RATE_BPS,
    interestAmount,
    processingFeeBps: PROCESSING_FEE_BPS,
    processingFeeAmount,
    expectedSettlementAmount,
  }
}
