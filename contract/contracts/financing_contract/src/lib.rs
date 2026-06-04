#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[contract]
pub struct Contract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum InvoiceStatus {
    PendingVerification,
    Verified,
    FinancingRequested,
    Funded,
    Settled,
    Closed,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FinancingStatus {
    PendingApproval,
    Approved,
    Rejected,
    Active,
    Settled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DepositSource {
    Xlm,
    FiatSimulation,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolInfo {
    pub total_liquidity: i128,
    pub available_liquidity: i128,
    pub total_shares: i128,
    pub total_platform_fees: i128,
    pub next_invoice_id: u64,
    pub next_request_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invoice {
    pub id: u64,
    pub supplier: Address,
    pub customer: Address,
    pub invoice_number: String,
    pub invoice_amount: i128,
    pub due_date: u64,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub verified_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinancingRequest {
    pub id: u64,
    pub invoice_id: u64,
    pub supplier: Address,
    pub gross_borrow_amount: i128,
    pub advance_rate_bps: u32,
    pub interest_rate_bps: u32,
    pub interest_amount: i128,
    pub processing_fee_bps: u32,
    pub processing_fee_amount: i128,
    pub expected_settlement_amount: i128,
    pub status: FinancingStatus,
    pub created_at: u64,
    pub approved_at: u64,
    pub settled_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvestorPosition {
    pub investor: Address,
    pub shares: i128,
    pub current_value: i128,
    pub deposited_amount: i128,
    pub earned_interest: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettlementBreakdown {
    pub invoice_amount: i128,
    pub principal_recovered: i128,
    pub interest_recovered: i128,
    pub processing_fee_recovered: i128,
    pub supplier_surplus: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    TokenAddress,
    TreasuryAddress,
    TotalLiquidity,
    AvailableLiquidity,
    TotalShares,
    TotalPlatformFees,
    NextInvoiceId,
    NextRequestId,
    InvestorShares(Address),
    InvestorDeposits(Address),
    Invoice(u64),
    FinancingRequest(u64),
}

fn event(env: &Env, name: &str, value: u64) {
    env.events()
        .publish((Symbol::new(env, name),), value);
}

fn require_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Admin) {
        panic!("contract not initialized")
    }
}

fn read_address(env: &Env, key: &DataKey) -> Address {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic!("address missing"))
}

fn read_i128(env: &Env, key: DataKey) -> i128 {
    env.storage().instance().get(&key).unwrap_or(0)
}

fn write_i128(env: &Env, key: DataKey, value: i128) {
    env.storage().instance().set(&key, &value);
}

fn read_u64(env: &Env, key: DataKey) -> u64 {
    env.storage().instance().get(&key).unwrap_or(0)
}

fn write_u64(env: &Env, key: DataKey, value: u64) {
    env.storage().instance().set(&key, &value);
}

fn read_invoice(env: &Env, invoice_id: u64) -> Invoice {
    env.storage()
        .instance()
        .get(&DataKey::Invoice(invoice_id))
        .unwrap_or_else(|| panic!("invoice not found"))
}

fn write_invoice(env: &Env, invoice: &Invoice) {
    env.storage()
        .instance()
        .set(&DataKey::Invoice(invoice.id), invoice);
}

fn read_request(env: &Env, request_id: u64) -> FinancingRequest {
    env.storage()
        .instance()
        .get(&DataKey::FinancingRequest(request_id))
        .unwrap_or_else(|| panic!("request not found"))
}

fn write_request(env: &Env, request: &FinancingRequest) {
    env.storage()
        .instance()
        .set(&DataKey::FinancingRequest(request.id), request);
}

fn read_investor_shares(env: &Env, investor: &Address) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::InvestorShares(investor.clone()))
        .unwrap_or(0)
}

fn write_investor_shares(env: &Env, investor: &Address, shares: i128) {
    env.storage()
        .instance()
        .set(&DataKey::InvestorShares(investor.clone()), &shares);
}

fn read_investor_deposits(env: &Env, investor: &Address) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::InvestorDeposits(investor.clone()))
        .unwrap_or(0)
}

fn write_investor_deposits(env: &Env, investor: &Address, amount: i128) {
    env.storage()
        .instance()
        .set(&DataKey::InvestorDeposits(investor.clone()), &amount);
}

fn read_pool_info(env: &Env) -> PoolInfo {
    PoolInfo {
        total_liquidity: read_i128(env, DataKey::TotalLiquidity),
        available_liquidity: read_i128(env, DataKey::AvailableLiquidity),
        total_shares: read_i128(env, DataKey::TotalShares),
        total_platform_fees: read_i128(env, DataKey::TotalPlatformFees),
        next_invoice_id: read_u64(env, DataKey::NextInvoiceId),
        next_request_id: read_u64(env, DataKey::NextRequestId),
    }
}

fn hydrate_investor_position(env: &Env, investor: &Address) -> InvestorPosition {
    let shares = read_investor_shares(env, investor);
    let deposits = read_investor_deposits(env, investor);
    let pool = read_pool_info(env);

    let current_value = if pool.total_shares == 0 {
        0
    } else {
        shares * pool.total_liquidity / pool.total_shares
    };

    InvestorPosition {
        investor: investor.clone(),
        shares,
        current_value,
        deposited_amount: deposits,
        earned_interest: current_value - deposits,
    }
}

fn require_admin(env: &Env, admin: &Address) {
    admin.require_auth();
    if admin != &read_address(env, &DataKey::Admin) {
        panic!("only admin allowed")
    }
}

fn now(env: &Env) -> u64 {
    env.ledger().timestamp()
}

fn credit_liquidity(env: &Env, investor: &Address, pool_token_amount: i128) -> i128 {
    let total_liquidity = read_i128(env, DataKey::TotalLiquidity);
    let total_shares = read_i128(env, DataKey::TotalShares);
    let shares = if total_shares == 0 || total_liquidity == 0 {
        pool_token_amount
    } else {
        pool_token_amount * total_shares / total_liquidity
    };

    let investor_shares = read_investor_shares(env, investor) + shares;
    let investor_deposits = read_investor_deposits(env, investor) + pool_token_amount;

    write_investor_shares(env, investor, investor_shares);
    write_investor_deposits(env, investor, investor_deposits);
    write_i128(env, DataKey::TotalLiquidity, total_liquidity + pool_token_amount);
    write_i128(
        env,
        DataKey::AvailableLiquidity,
        read_i128(env, DataKey::AvailableLiquidity) + pool_token_amount,
    );
    write_i128(env, DataKey::TotalShares, total_shares + shares);

    shares
}

#[contractimpl]
impl Contract {
    pub fn initialize(env: Env, admin: Address, token_address: Address, treasury_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("contract already initialized")
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenAddress, &token_address);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryAddress, &treasury_address);
        write_i128(&env, DataKey::TotalLiquidity, 0);
        write_i128(&env, DataKey::AvailableLiquidity, 0);
        write_i128(&env, DataKey::TotalShares, 0);
        write_i128(&env, DataKey::TotalPlatformFees, 0);
        write_u64(&env, DataKey::NextInvoiceId, 0);
        write_u64(&env, DataKey::NextRequestId, 0);
    }

    pub fn record_xlm_deposit(
        env: Env,
        investor: Address,
        xlm_amount: i128,
        pool_token_amount: i128,
        _tx_hash: String,
    ) -> i128 {
        require_initialized(&env);
        investor.require_auth();

        if xlm_amount <= 0 || pool_token_amount <= 0 {
            panic!("amount must be positive")
        }

        let shares = credit_liquidity(&env, &investor, pool_token_amount);

        event(&env, "XlmDeposited", 1);
        shares
    }

    pub fn simulate_fiat_deposit(
        env: Env,
        investor: Address,
        fiat_amount: i128,
        pool_token_amount: i128,
    ) -> i128 {
        require_initialized(&env);
        investor.require_auth();

        if fiat_amount <= 0 || pool_token_amount <= 0 {
            panic!("amount must be positive")
        }

        let shares = credit_liquidity(&env, &investor, pool_token_amount);
        event(&env, "FiatDepositSimulated", 1);
        shares
    }

    pub fn withdraw_liquidity(env: Env, investor: Address, shares: i128) -> i128 {
        require_initialized(&env);
        investor.require_auth();

        if shares <= 0 {
            panic!("shares must be positive")
        }

        let pool = read_pool_info(&env);
        if pool.total_shares == 0 {
            panic!("pool has no shares")
        }

        let owned = read_investor_shares(&env, &investor);
        if shares > owned {
            panic!("insufficient investor shares")
        }

        let withdraw_amount = shares * pool.total_liquidity / pool.total_shares;
        if withdraw_amount > pool.available_liquidity {
            panic!("insufficient available liquidity")
        }

        write_investor_shares(&env, &investor, owned - shares);
        write_investor_deposits(
            &env,
            &investor,
            read_investor_deposits(&env, &investor) - withdraw_amount,
        );
        write_i128(&env, DataKey::TotalLiquidity, pool.total_liquidity - withdraw_amount);
        write_i128(
            &env,
            DataKey::AvailableLiquidity,
            pool.available_liquidity - withdraw_amount,
        );
        write_i128(&env, DataKey::TotalShares, pool.total_shares - shares);

        event(&env, "LiquidityWithdrawn", 1);
        withdraw_amount
    }

    pub fn create_invoice(
        env: Env,
        supplier: Address,
        customer: Address,
        invoice_number: String,
        invoice_amount: i128,
        due_date: u64,
    ) -> u64 {
        require_initialized(&env);
        supplier.require_auth();

        if invoice_amount <= 0 {
            panic!("invoice amount must be positive")
        }

        let invoice_id = read_u64(&env, DataKey::NextInvoiceId) + 1;
        write_u64(&env, DataKey::NextInvoiceId, invoice_id);

        write_invoice(
            &env,
            &Invoice {
                id: invoice_id,
                supplier,
                customer,
                invoice_number,
                invoice_amount,
                due_date,
                status: InvoiceStatus::PendingVerification,
                created_at: now(&env),
                verified_at: 0,
            },
        );

        event(&env, "InvoiceCreated", invoice_id);
        invoice_id
    }

    pub fn verify_invoice(env: Env, customer: Address, invoice_id: u64) {
        require_initialized(&env);
        customer.require_auth();

        let mut invoice = read_invoice(&env, invoice_id);
        if customer != invoice.customer {
            panic!("customer mismatch")
        }
        if invoice.status != InvoiceStatus::PendingVerification {
            panic!("invoice is not pending verification")
        }

        invoice.status = InvoiceStatus::Verified;
        invoice.verified_at = now(&env);
        write_invoice(&env, &invoice);
        event(&env, "InvoiceVerified", invoice_id);
    }

    pub fn reject_invoice(env: Env, customer_or_admin: Address, invoice_id: u64) {
        require_initialized(&env);
        customer_or_admin.require_auth();

        let mut invoice = read_invoice(&env, invoice_id);
        let admin = read_address(&env, &DataKey::Admin);
        if customer_or_admin != invoice.customer && customer_or_admin != admin {
            panic!("not authorized to reject invoice")
        }

        invoice.status = InvoiceStatus::Rejected;
        write_invoice(&env, &invoice);
    }

    pub fn get_invoice(env: Env, invoice_id: u64) -> Invoice {
        require_initialized(&env);
        read_invoice(&env, invoice_id)
    }

    pub fn request_financing(
        env: Env,
        supplier: Address,
        invoice_id: u64,
        advance_rate_bps: u32,
        interest_rate_bps: u32,
        processing_fee_bps: u32,
    ) -> u64 {
        require_initialized(&env);
        supplier.require_auth();

        let mut invoice = read_invoice(&env, invoice_id);
        if supplier != invoice.supplier {
            panic!("supplier mismatch")
        }
        if invoice.status != InvoiceStatus::Verified {
            panic!("invoice must be verified")
        }

        let gross_borrow_amount = invoice.invoice_amount * advance_rate_bps as i128 / 10_000;
        let interest_amount = gross_borrow_amount * interest_rate_bps as i128 / 10_000;
        let processing_fee_amount = gross_borrow_amount * processing_fee_bps as i128 / 10_000;
        let expected_settlement_amount =
            gross_borrow_amount + interest_amount + processing_fee_amount;

        let request_id = read_u64(&env, DataKey::NextRequestId) + 1;
        write_u64(&env, DataKey::NextRequestId, request_id);

        invoice.status = InvoiceStatus::FinancingRequested;
        write_invoice(&env, &invoice);

        write_request(
            &env,
            &FinancingRequest {
                id: request_id,
                invoice_id,
                supplier,
                gross_borrow_amount,
                advance_rate_bps,
                interest_rate_bps,
                interest_amount,
                processing_fee_bps,
                processing_fee_amount,
                expected_settlement_amount,
                status: FinancingStatus::PendingApproval,
                created_at: now(&env),
                approved_at: 0,
                settled_at: 0,
            },
        );

        event(&env, "FinancingRequested", request_id);
        request_id
    }

    pub fn approve_financing(env: Env, admin: Address, request_id: u64) {
        require_initialized(&env);
        require_admin(&env, &admin);

        let mut request = read_request(&env, request_id);
        if request.status != FinancingStatus::PendingApproval {
            panic!("request is not pending approval")
        }

        request.status = FinancingStatus::Approved;
        request.approved_at = now(&env);
        write_request(&env, &request);
        event(&env, "FinancingApproved", request_id);
    }

    pub fn reject_financing(env: Env, admin: Address, request_id: u64) {
        require_initialized(&env);
        require_admin(&env, &admin);

        let mut request = read_request(&env, request_id);
        if request.status != FinancingStatus::PendingApproval {
            panic!("request is not pending approval")
        }

        let mut invoice = read_invoice(&env, request.invoice_id);
        invoice.status = InvoiceStatus::Verified;
        write_invoice(&env, &invoice);

        request.status = FinancingStatus::Rejected;
        write_request(&env, &request);
        event(&env, "FinancingRejected", request_id);
    }

    pub fn borrow(env: Env, supplier: Address, request_id: u64) {
        require_initialized(&env);
        supplier.require_auth();

        let mut request = read_request(&env, request_id);
        let mut invoice = read_invoice(&env, request.invoice_id);

        if supplier != request.supplier {
            panic!("supplier mismatch")
        }
        if invoice.status != InvoiceStatus::FinancingRequested {
            panic!("invoice is not financing requested")
        }
        if request.status != FinancingStatus::Approved {
            panic!("request is not approved")
        }

        let available_liquidity = read_i128(&env, DataKey::AvailableLiquidity);
        if request.gross_borrow_amount > available_liquidity {
            panic!("insufficient liquidity")
        }

        write_i128(
            &env,
            DataKey::AvailableLiquidity,
            available_liquidity - request.gross_borrow_amount,
        );

        request.status = FinancingStatus::Active;
        invoice.status = InvoiceStatus::Funded;
        write_request(&env, &request);
        write_invoice(&env, &invoice);
        event(&env, "Borrowed", request_id);
    }

    pub fn get_financing_request(env: Env, request_id: u64) -> FinancingRequest {
        require_initialized(&env);
        read_request(&env, request_id)
    }

    pub fn settle_invoice(env: Env, customer: Address, request_id: u64) -> SettlementBreakdown {
        require_initialized(&env);
        customer.require_auth();

        let mut request = read_request(&env, request_id);
        let mut invoice = read_invoice(&env, request.invoice_id);

        if customer != invoice.customer {
            panic!("customer mismatch")
        }
        if request.status != FinancingStatus::Active {
            panic!("request is not active")
        }
        if invoice.status != InvoiceStatus::Funded {
            panic!("invoice is not funded")
        }

        let principal_recovered = request.gross_borrow_amount;
        let interest_recovered = request.interest_amount;
        let processing_fee_recovered = request.processing_fee_amount;
        let supplier_surplus = invoice.invoice_amount
            - principal_recovered
            - interest_recovered
            - processing_fee_recovered;

        if supplier_surplus < 0 {
            panic!("invoice amount cannot cover settlement")
        }

        write_i128(
            &env,
            DataKey::AvailableLiquidity,
            read_i128(&env, DataKey::AvailableLiquidity)
                + principal_recovered
                + interest_recovered,
        );
        write_i128(
            &env,
            DataKey::TotalLiquidity,
            read_i128(&env, DataKey::TotalLiquidity) + interest_recovered,
        );
        write_i128(
            &env,
            DataKey::TotalPlatformFees,
            read_i128(&env, DataKey::TotalPlatformFees) + processing_fee_recovered,
        );

        request.status = FinancingStatus::Settled;
        request.settled_at = now(&env);
        invoice.status = InvoiceStatus::Settled;
        write_request(&env, &request);
        write_invoice(&env, &invoice);

        event(&env, "InvoiceSettled", request_id);
        event(&env, "ProcessingFeeCollected", request_id);

        SettlementBreakdown {
            invoice_amount: invoice.invoice_amount,
            principal_recovered,
            interest_recovered,
            processing_fee_recovered,
            supplier_surplus,
        }
    }

    pub fn get_pool_info(env: Env) -> PoolInfo {
        require_initialized(&env);
        read_pool_info(&env)
    }

    pub fn get_investor_position(env: Env, investor: Address) -> InvestorPosition {
        require_initialized(&env);
        hydrate_investor_position(&env, &investor)
    }
}

mod test;
