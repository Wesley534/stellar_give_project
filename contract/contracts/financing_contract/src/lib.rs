#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol};

#[contract]
pub struct Contract;

const BPS_DENOMINATOR: i128 = 10_000;
const MAX_PROCESSING_FEE_BPS: u32 = 2_000;
const MAX_INTEREST_RATE_BPS: u32 = 10_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum InvoiceStatus {
    PendingVerification,
    Verified,
    FinancingRequested,
    Approved,
    Funded,
    Settled,
    Rejected,
    Defaulted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FinancingStatus {
    PendingApproval,
    Approved,
    Rejected,
    Active,
    Settled,
    Defaulted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolInfo {
    pub admin: Address,
    pub token_address: Address,
    pub total_liquidity: i128,
    pub available_liquidity: i128,
    pub total_shares: i128,
    pub total_platform_fees: i128,
    pub total_outstanding_principal: i128,
    pub total_interest_earned: i128,
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
    pub invoice_amount: i128,
    pub advance_rate_bps: u32,
    pub principal_amount: i128,
    pub interest_rate_bps: u32,
    pub interest_amount: i128,
    pub processing_fee_bps: u32,
    pub processing_fee_amount: i128,
    pub expected_repayment_amount: i128,
    pub supplier_expected_surplus: i128,
    pub status: FinancingStatus,
    pub created_at: u64,
    pub approved_at: u64,
    pub settled_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvestorPosition {
    pub investor_shares: i128,
    pub estimated_withdrawable_amount: i128,
    pub pool_share_bps: i128,
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
    TotalLiquidity,
    AvailableLiquidity,
    TotalShares,
    TotalPlatformFees,
    TotalOutstandingPrincipal,
    TotalInterestEarned,
    NextInvoiceId,
    NextRequestId,
    InvestorShares(Address),
    Invoice(u64),
    FinancingRequest(u64),
}

fn publish_u64(env: &Env, name: &str, value: u64) {
    env.events().publish((Symbol::new(env, name),), value);
}

fn publish_i128(env: &Env, name: &str, value: i128) {
    env.events().publish((Symbol::new(env, name),), value);
}

fn require_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Admin) {
        panic!("contract not initialized")
    }
}

fn require_positive(amount: i128, label: &str) {
    if amount <= 0 {
        panic!("{}", label)
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

fn read_pool_info(env: &Env) -> PoolInfo {
    PoolInfo {
        admin: read_address(env, &DataKey::Admin),
        token_address: read_address(env, &DataKey::TokenAddress),
        total_liquidity: read_i128(env, DataKey::TotalLiquidity),
        available_liquidity: read_i128(env, DataKey::AvailableLiquidity),
        total_shares: read_i128(env, DataKey::TotalShares),
        total_platform_fees: read_i128(env, DataKey::TotalPlatformFees),
        total_outstanding_principal: read_i128(env, DataKey::TotalOutstandingPrincipal),
        total_interest_earned: read_i128(env, DataKey::TotalInterestEarned),
        next_invoice_id: read_u64(env, DataKey::NextInvoiceId),
        next_request_id: read_u64(env, DataKey::NextRequestId),
    }
}

fn hydrate_investor_position(env: &Env, investor: &Address) -> InvestorPosition {
    let shares = read_investor_shares(env, investor);
    let pool = read_pool_info(env);
    let estimated_withdrawable_amount = if pool.total_shares == 0 {
        0
    } else {
        shares * pool.total_liquidity / pool.total_shares
    };
    let pool_share_bps = if pool.total_shares == 0 {
        0
    } else {
        shares * BPS_DENOMINATOR / pool.total_shares
    };

    InvestorPosition {
        investor_shares: shares,
        estimated_withdrawable_amount,
        pool_share_bps,
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

fn token_client(env: &Env) -> token::Client<'_> {
    token::Client::new(env, &read_address(env, &DataKey::TokenAddress))
}

fn contract_address(env: &Env) -> Address {
    env.current_contract_address()
}

fn transfer_into_contract(env: &Env, from: &Address, amount: i128) {
    let contract = contract_address(env);
    token_client(env).transfer_from(&contract, from, &contract, &amount);
}

fn transfer_from_contract(env: &Env, to: &Address, amount: i128) {
    let contract = contract_address(env);
    token_client(env).transfer(&contract, to, &amount);
}

fn mint_pool_shares(env: &Env, investor: &Address, amount: i128) -> i128 {
    let total_liquidity = read_i128(env, DataKey::TotalLiquidity);
    let total_shares = read_i128(env, DataKey::TotalShares);
    let shares_to_mint = if total_shares == 0 || total_liquidity == 0 {
        amount
    } else {
        amount * total_shares / total_liquidity
    };

    if shares_to_mint <= 0 {
        panic!("deposit too small for share minting")
    }

    write_investor_shares(
        env,
        investor,
        read_investor_shares(env, investor) + shares_to_mint,
    );
    write_i128(env, DataKey::TotalShares, total_shares + shares_to_mint);
    write_i128(env, DataKey::TotalLiquidity, total_liquidity + amount);
    write_i128(
        env,
        DataKey::AvailableLiquidity,
        read_i128(env, DataKey::AvailableLiquidity) + amount,
    );

    shares_to_mint
}

fn validate_financing_terms(
    invoice_amount: i128,
    advance_rate_bps: u32,
    interest_rate_bps: u32,
    processing_fee_bps: u32,
) {
    require_positive(invoice_amount, "invoice amount must be positive");

    if advance_rate_bps == 0 || advance_rate_bps > BPS_DENOMINATOR as u32 {
        panic!("advance rate out of range")
    }
    if interest_rate_bps > MAX_INTEREST_RATE_BPS {
        panic!("interest rate out of range")
    }
    if processing_fee_bps > MAX_PROCESSING_FEE_BPS {
        panic!("processing fee out of range")
    }
}

#[contractimpl]
impl Contract {
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("contract already initialized")
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenAddress, &token_address);
        write_i128(&env, DataKey::TotalLiquidity, 0);
        write_i128(&env, DataKey::AvailableLiquidity, 0);
        write_i128(&env, DataKey::TotalShares, 0);
        write_i128(&env, DataKey::TotalPlatformFees, 0);
        write_i128(&env, DataKey::TotalOutstandingPrincipal, 0);
        write_i128(&env, DataKey::TotalInterestEarned, 0);
        write_u64(&env, DataKey::NextInvoiceId, 0);
        write_u64(&env, DataKey::NextRequestId, 0);
    }

    pub fn deposit(env: Env, investor: Address, amount: i128) -> i128 {
        require_initialized(&env);
        investor.require_auth();
        require_positive(amount, "amount must be positive");

        transfer_into_contract(&env, &investor, amount);
        let shares_to_mint = mint_pool_shares(&env, &investor, amount);

        publish_i128(&env, "investor_deposited", amount);
        shares_to_mint
    }

    pub fn withdraw(env: Env, investor: Address, share_amount: i128) -> i128 {
        require_initialized(&env);
        investor.require_auth();
        require_positive(share_amount, "shares must be positive");

        let pool = read_pool_info(&env);
        if pool.total_shares == 0 {
            panic!("pool has no shares")
        }

        let investor_shares = read_investor_shares(&env, &investor);
        if share_amount > investor_shares {
            panic!("insufficient investor shares")
        }

        let withdraw_amount = share_amount * pool.total_liquidity / pool.total_shares;
        if withdraw_amount > pool.available_liquidity {
            panic!("insufficient available liquidity")
        }

        write_investor_shares(&env, &investor, investor_shares - share_amount);
        write_i128(&env, DataKey::TotalShares, pool.total_shares - share_amount);
        write_i128(
            &env,
            DataKey::TotalLiquidity,
            pool.total_liquidity - withdraw_amount,
        );
        write_i128(
            &env,
            DataKey::AvailableLiquidity,
            pool.available_liquidity - withdraw_amount,
        );

        transfer_from_contract(&env, &investor, withdraw_amount);
        publish_i128(&env, "investor_withdrawn", withdraw_amount);
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
        require_positive(invoice_amount, "invoice amount must be positive");

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

        publish_u64(&env, "invoice_created", invoice_id);
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
        publish_u64(&env, "invoice_verified", invoice_id);
    }

    pub fn reject_invoice(env: Env, customer_or_admin: Address, invoice_id: u64) {
        require_initialized(&env);
        customer_or_admin.require_auth();

        let mut invoice = read_invoice(&env, invoice_id);
        let admin = read_address(&env, &DataKey::Admin);
        if customer_or_admin != invoice.customer && customer_or_admin != admin {
            panic!("not authorized to reject invoice")
        }
        if invoice.status == InvoiceStatus::Funded || invoice.status == InvoiceStatus::Settled {
            panic!("cannot reject funded or settled invoice")
        }

        invoice.status = InvoiceStatus::Rejected;
        write_invoice(&env, &invoice);
    }

    pub fn mark_defaulted(env: Env, admin: Address, request_id: u64) {
        require_initialized(&env);
        require_admin(&env, &admin);

        let mut request = read_request(&env, request_id);
        if request.status != FinancingStatus::Active {
            panic!("request is not active")
        }

        let mut invoice = read_invoice(&env, request.invoice_id);
        request.status = FinancingStatus::Defaulted;
        invoice.status = InvoiceStatus::Defaulted;
        write_request(&env, &request);
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

        validate_financing_terms(
            invoice.invoice_amount,
            advance_rate_bps,
            interest_rate_bps,
            processing_fee_bps,
        );

        let principal_amount = invoice.invoice_amount * advance_rate_bps as i128 / BPS_DENOMINATOR;
        let interest_amount = principal_amount * interest_rate_bps as i128 / BPS_DENOMINATOR;
        let processing_fee_amount = principal_amount * processing_fee_bps as i128 / BPS_DENOMINATOR;
        let expected_repayment_amount = principal_amount + interest_amount + processing_fee_amount;

        if expected_repayment_amount > invoice.invoice_amount {
            panic!("invoice amount cannot cover expected repayment")
        }

        let supplier_expected_surplus = invoice.invoice_amount - expected_repayment_amount;
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
                invoice_amount: invoice.invoice_amount,
                advance_rate_bps,
                principal_amount,
                interest_rate_bps,
                interest_amount,
                processing_fee_bps,
                processing_fee_amount,
                expected_repayment_amount,
                supplier_expected_surplus,
                status: FinancingStatus::PendingApproval,
                created_at: now(&env),
                approved_at: 0,
                settled_at: 0,
            },
        );

        publish_u64(&env, "financing_requested", request_id);
        request_id
    }

    pub fn approve_financing(env: Env, admin: Address, request_id: u64) {
        require_initialized(&env);
        require_admin(&env, &admin);

        let mut request = read_request(&env, request_id);
        if request.status != FinancingStatus::PendingApproval {
            panic!("request is not pending approval")
        }

        let mut invoice = read_invoice(&env, request.invoice_id);
        request.status = FinancingStatus::Approved;
        request.approved_at = now(&env);
        invoice.status = InvoiceStatus::Approved;

        write_request(&env, &request);
        write_invoice(&env, &invoice);
        publish_u64(&env, "financing_approved", request_id);
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
        request.status = FinancingStatus::Rejected;
        write_invoice(&env, &invoice);
        write_request(&env, &request);
        publish_u64(&env, "financing_rejected", request_id);
    }

    pub fn borrow(env: Env, supplier: Address, request_id: u64) {
        require_initialized(&env);
        supplier.require_auth();

        let mut request = read_request(&env, request_id);
        let mut invoice = read_invoice(&env, request.invoice_id);

        if supplier != request.supplier {
            panic!("supplier mismatch")
        }
        if request.status != FinancingStatus::Approved {
            panic!("request is not approved")
        }
        if invoice.status != InvoiceStatus::Approved {
            panic!("invoice is not approved")
        }

        let available_liquidity = read_i128(&env, DataKey::AvailableLiquidity);
        if request.principal_amount > available_liquidity {
            panic!("insufficient liquidity")
        }

        write_i128(
            &env,
            DataKey::AvailableLiquidity,
            available_liquidity - request.principal_amount,
        );
        write_i128(
            &env,
            DataKey::TotalOutstandingPrincipal,
            read_i128(&env, DataKey::TotalOutstandingPrincipal) + request.principal_amount,
        );

        request.status = FinancingStatus::Active;
        invoice.status = InvoiceStatus::Funded;
        write_request(&env, &request);
        write_invoice(&env, &invoice);

        transfer_from_contract(&env, &supplier, request.principal_amount);
        publish_u64(&env, "financing_disbursed", request_id);
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
        if invoice.invoice_amount < request.expected_repayment_amount {
            panic!("invoice amount cannot cover settlement")
        }

        transfer_into_contract(&env, &customer, invoice.invoice_amount);

        let principal_recovered = request.principal_amount;
        let interest_recovered = request.interest_amount;
        let processing_fee_recovered = request.processing_fee_amount;
        let supplier_surplus = request.supplier_expected_surplus;

        write_i128(
            &env,
            DataKey::AvailableLiquidity,
            read_i128(&env, DataKey::AvailableLiquidity) + principal_recovered + interest_recovered,
        );
        write_i128(
            &env,
            DataKey::TotalLiquidity,
            read_i128(&env, DataKey::TotalLiquidity) + interest_recovered,
        );
        write_i128(
            &env,
            DataKey::TotalOutstandingPrincipal,
            read_i128(&env, DataKey::TotalOutstandingPrincipal) - principal_recovered,
        );
        write_i128(
            &env,
            DataKey::TotalPlatformFees,
            read_i128(&env, DataKey::TotalPlatformFees) + processing_fee_recovered,
        );
        write_i128(
            &env,
            DataKey::TotalInterestEarned,
            read_i128(&env, DataKey::TotalInterestEarned) + interest_recovered,
        );

        if supplier_surplus > 0 {
            transfer_from_contract(&env, &invoice.supplier, supplier_surplus);
        }

        request.status = FinancingStatus::Settled;
        request.settled_at = now(&env);
        invoice.status = InvoiceStatus::Settled;
        write_request(&env, &request);
        write_invoice(&env, &invoice);

        publish_u64(&env, "invoice_settled", request_id);

        SettlementBreakdown {
            invoice_amount: invoice.invoice_amount,
            principal_recovered,
            interest_recovered,
            processing_fee_recovered,
            supplier_surplus,
        }
    }

    pub fn withdraw_platform_fees(env: Env, admin: Address, amount: i128) {
        require_initialized(&env);
        require_admin(&env, &admin);
        require_positive(amount, "amount must be positive");

        let available_fees = read_i128(&env, DataKey::TotalPlatformFees);
        if amount > available_fees {
            panic!("insufficient platform fees")
        }

        write_i128(&env, DataKey::TotalPlatformFees, available_fees - amount);
        transfer_from_contract(&env, &admin, amount);
        publish_i128(&env, "platform_fees_withdrawn", amount);
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
