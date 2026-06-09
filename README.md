# Invoice Financing Marketplace

Unlock working capital for suppliers through investor-funded liquidity pools powered by Stellar and Soroban.

## Live Demo

Frontend:
https://invoicefinancing.netlify.app/

Backend API:
https://nathan-costumes-evaluation-setting.trycloudflare.com/api

Swagger Documentation:
https://nathan-costumes-evaluation-setting.trycloudflare.com/api-docs/

Soroban Contract:
`CD33VCIHDG3HTFTXLQ6YET2AIAFRWMM6QCA7DU37SUHXZ7OMQT4GNM4S`

Network:
Stellar Testnet

## Problem

Suppliers often wait 30–90 days for customers to pay invoices.

This creates cash flow challenges that limit business growth and operations.

Many SMEs cannot access affordable working capital despite having valid invoices from trusted customers.

## Solution

Our platform allows suppliers to receive financing against verified invoices.

Investors provide liquidity through a shared pool.

Once customers repay invoices, the platform automatically settles financing obligations and distributes funds according to predefined rules.

## How It Works

1. Investor deposits XLM or simulated fiat into the liquidity pool.
2. Supplier creates an invoice and assigns a customer.
3. Customer verifies the invoice, confirming delivery and validity.
4. Supplier requests financing with defined advance rate, interest rate, and processing fee.
5. Admin reviews and approves the financing request.
6. Funds are disbursed from the pool to the supplier.
7. Customer pays the invoice through the platform.
8. Contract recovers principal, interest, and fees.
9. Remaining balance is paid to the supplier.

## Why Stellar?

We use Stellar and Soroban to:

- Manage liquidity pool balances on-chain
- Track investor share ownership transparently
- Record financing agreements immutably
- Handle repayments and settlement through smart contracts
- Provide transparent auditability of all transactions
- Enable trustless contract execution without intermediaries

Core financing logic lives on-chain through Soroban smart contracts, while the web application handles user experience, off-chain data, and transaction orchestration.

## Architecture

Frontend:
- React + Vite
- TypeScript
- TanStack Query
- Freighter Wallet integration

Backend:
- Express
- Prisma ORM
- SQLite
- Swagger UI

Blockchain:
- Stellar Testnet
- Soroban Smart Contracts
- SEP-41 Token (IFX)
- Freighter Wallet

## Soroban Contract Features

- Liquidity pool deposits with proportional share minting
- Investor position tracking with estimated withdrawable amounts
- Invoice creation and lifecycle management (pending verification, verified, financing requested, funded, settled, rejected, defaulted)
- Financing request creation with configurable advance rate, interest rate, and processing fee
- Admin approval and rejection of financing requests
- Borrower fund disbursement with liquidity availability checks
- Customer invoice settlement with automatic principal, interest, and fee distribution
- Supplier surplus payout after settlement
- Platform fee accumulation and admin withdrawal
- Pool accounting with total liquidity, available liquidity, and outstanding principal tracking

## On-Chain vs Off-Chain

On-chain (Soroban Smart Contract):
- Liquidity pool balances and share ownership
- Invoice records and verification status
- Financing requests and approval status
- Fund disbursement and repayment settlement
- Interest and fee distribution

Off-chain (Backend + Database):
- User authentication and role management
- Wallet connection management
- Invoice metadata and descriptions
- Financing request configuration (rates, fees)
- Transaction history and audit logs
- Settlement breakdown records
- Platform fee tracking

## Smart Contract Reference

Contract ID: `CD33VCIHDG3HTFTXLQ6YET2AIAFRWMM6QCA7DU37SUHXZ7OMQT4GNM4S`

Token Address: `CCVWT6KV4NGR3MD4YJVSZJYUNNRRQYSLFXRIMDYRTJVA5D6BKFIGGMTG`

Token: IFX (SEP-41 compliant)

Network Passphrase: `Test SDF Network ; September 2015`

RPC URL: `https://soroban-testnet.stellar.org`

## Impact

This project improves access to working capital for SMEs that are unable to wait for invoice payment cycles.

By unlocking cash tied up in invoices, businesses can:

- Purchase inventory
- Pay employees
- Expand operations
- Maintain healthy cash flow

The solution is particularly relevant for SMEs across Africa, where invoice payment cycles of 30–90 days are common and formal financing access is limited.



## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or use default SQLite for local development)
- Stellar CLI (`stellar`)
- Freighter Wallet browser extension

### Backend

```bash
cd backend
cp .env.example .env   # edit STELLAR_* variables for your environment
npm install
npm run prisma:migrate
npm run dev
```

Backend runs at `http://localhost:5000`

Swagger UI: `http://localhost:5000/api-docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### Stellar Environment Setup

```bash
stellar keys generate admin

stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

### Soroban Contract Deployment

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/financing_contract.wasm \
  --source-account admin \
  --network testnet \
  --alias financing-pool
```

Update `STELLAR_CONTRACT_ID` in `backend/.env` with the deployed contract ID.

Fund the IFX token address for investor testing (requires token issuer secret key configured in `.env`).

## User Roles

- **Investor**: Deposit liquidity, view pool position, withdraw funds, track earnings
- **Borrower (Supplier)**: Create invoices, request financing, borrow approved funds, track repayments
- **Customer**: Review invoices, verify or reject invoices, settle payments
- **Administrator**: Review financing requests, approve or reject, disburse funds, monitor pool health, withdraw platform fees

## Testing the Main User Flow

### 1. Register Users

Create accounts for each role:
```bash
POST /api/auth/register
{
  "name": "Investor One",
  "email": "investor@example.com",
  "password": "password123",
  "role": "INVESTOR"
}
```

Repeat for BORROWER, CUSTOMER, and ADMIN roles.

### 2. Connect Freighter Wallets

Log in to each role and connect a Freighter wallet.

### 3. Investor Deposits

As INVESTOR:
1. Navigate to Liquidity Pool page
2. Enter deposit amount (XLM or simulated fiat)
3. Confirm transaction in Freighter
4. Verify pool shares are minted

### 4. Borrower Creates Invoice

As BORROWER:
1. Navigate to Borrower Dashboard
2. Create invoice with customer details, amount, and due date
3. Invoice status: PENDING_VERIFICATION

### 5. Customer Verifies Invoice

As CUSTOMER:
1. Navigate to Financing Requests page
2. Review pending invoice
3. Click "Verify" to confirm invoice validity

### 6. Borrower Requests Financing

As BORROWER:
1. Navigate to verified invoice
2. Click "Request Financing"
3. Set advance rate, interest rate, and processing fee
4. Submit request

### 7. Admin Approves Financing

As ADMIN:
1. Navigate to Admin Dashboard
2. Review pending financing request
3. Click "Approve"

### 8. Borrower Borrows Funds

As BORROWER:
1. Navigate to active financing request
2. Click "Borrow"
3. Confirm disbursement in Freighter
4. Funds transferred from pool to supplier

### 9. Customer Settles Invoice

As CUSTOMER:
1. Navigate to funded invoice
2. Click "Pay Invoice"
3. Confirm payment in Freighter
4. Contract distributes principal, interest, and fees; surplus paid to supplier

### 10. Investor Withdraws

As INVESTOR:
1. Navigate to Liquidity Pool page
2. Enter share amount to withdraw
3. Confirm transaction in Freighter
4. Verify updated position

## Tech Stack

Frontend:
- React 19
- Vite
- TypeScript
- TanStack Query
- Axios
- Freighter API
- React Router DOM

Backend:
- Express 5
- TypeScript
- Prisma ORM
- SQLite
- Zod validation
- JWT + bcrypt
- Swagger UI

Blockchain:
- Stellar Testnet
- Soroban Smart Contracts (Rust)
- SEP-41 Token (IFX)
- Freighter Wallet

## Team

Peter Wesley - Team Lead / Blockchain / Backend
https://github.com/wesley534

Hori Munana - Frontend
https://github.com/horimunana

Maureen Wanjiku Mburu - Frontend
https://github.com/maureen03571
