# Invoice Financing Soroban MVP

This contract implements a token-backed invoice financing pool on Soroban.

## What changed

- Investors deposit a SEP-41 compatible token into the contract.
- Deposits mint pool shares based on current pool value.
- Approved financing requests disburse real tokens to the supplier.
- Customer settlement pulls the full invoice amount into the contract.
- Principal and interest return to the pool, processing fees are tracked separately, and any surplus is forwarded to the supplier.

## Core flow

1. Deploy or choose a SEP-41 compatible token contract to act as the financing asset.
2. Initialize the financing contract with:
   - `admin`
   - `token_address`
3. Investors approve the financing contract to spend their tokens, then call `deposit`.
4. A supplier creates an invoice and the customer verifies it.
5. The supplier requests financing.
6. The admin approves the request.
7. The supplier calls `borrow` and receives the principal in tokens.
8. The customer approves the contract and calls `settle_invoice`.
9. Investors withdraw based on shares, and the admin can withdraw accrued platform fees.

## Token deployment

For local tests, Soroban can use a Stellar Asset Contract. In production, deploy any SEP-41 compatible token you want to use for pool liquidity, such as `IFX` or a mock stable asset like `mUSDC`.

You will need the token contract address for initialization.

## Initialize the financing contract

Initialize once with:

```text
initialize(admin: Address, token_address: Address)
```

The `admin` can:

- approve financing requests
- reject financing requests
- mark requests defaulted
- withdraw platform fees

## Investor deposit and approval flow

Before depositing, the investor must approve the financing contract on the token contract.

High-level flow:

1. Call token `approve(investor, financing_contract, amount, expiration_ledger)`
2. Call financing contract `deposit(investor, amount)`

The contract then:

- transfers tokens from the investor into the financing pool
- mints pool shares
- increases `total_liquidity` and `available_liquidity`

Share minting:

```text
if total_shares == 0:
  shares_to_mint = deposit_amount
else:
  shares_to_mint = deposit_amount * total_shares / total_liquidity
```

## Supplier financing flow

The supplier creates the invoice:

```text
create_invoice(supplier, customer, invoice_number, invoice_amount, due_date)
```

The customer verifies it:

```text
verify_invoice(customer, invoice_id)
```

The supplier requests financing:

```text
request_financing(
  supplier,
  invoice_id,
  advance_rate_bps,
  interest_rate_bps,
  processing_fee_bps
)
```

Stored financing values include:

- `invoice_amount`
- `principal_amount`
- `interest_amount`
- `processing_fee_amount`
- `expected_repayment_amount`
- `supplier_expected_surplus`

The admin approves:

```text
approve_financing(admin, request_id)
```

The supplier receives disbursement when they call:

```text
borrow(supplier, request_id)
```

That call:

- checks available liquidity
- reduces `available_liquidity`
- increases `total_outstanding_principal`
- transfers principal tokens from the contract to the supplier

## Customer repayment flow

Before repayment, the customer must approve the financing contract on the token contract.

High-level flow:

1. Call token `approve(customer, financing_contract, invoice_amount, expiration_ledger)`
2. Call financing contract `settle_invoice(customer, request_id)`

Settlement behavior:

- transfers the full invoice amount from the customer to the contract
- returns principal to available pool liquidity
- adds interest to pool value
- adds processing fees to `total_platform_fees`
- forwards any remaining supplier surplus to the supplier

For this MVP, settlement requires the full invoice amount and does not support partial payments.

## Investor withdrawals

Investors withdraw by shares:

```text
withdraw(investor, share_amount)
```

Withdraw amount:

```text
withdraw_amount = investor_shares * total_liquidity / total_shares
```

The contract prevents withdrawals that exceed available liquidity.

## Platform fee withdrawal

The admin can withdraw accumulated fees:

```text
withdraw_platform_fees(admin, amount)
```

This transfers tokens from the contract to the admin wallet and reduces `total_platform_fees`.

## Useful read methods

- `get_pool_info()`
- `get_investor_position(investor)`
- `get_invoice(invoice_id)`
- `get_financing_request(request_id)`

## Test coverage

The contract tests cover:

- initialization with admin and token address
- token-backed investor deposits
- proportional share minting for a second investor
- invoice creation and verification
- financing request approval and rejection
- supplier disbursement
- customer repayment
- pool interest accrual
- supplier surplus transfer
- investor withdrawals
- platform fee withdrawals
- unauthorized approval attempts
- insufficient liquidity protection
- duplicate settlement protection
