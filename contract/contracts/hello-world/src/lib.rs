#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contract]
pub struct Contract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RequestStatus {
    PendingAdminReview,
    Approved,
    Rejected,
    Borrowed,
    Repaid,
    Closed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolInfo {
    pub total_liquidity: i128,
    pub available_liquidity: i128,
    pub total_shares: i128,
    pub total_loans: u64,
    pub outstanding_loans: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvestorPosition {
    pub shares_owned: i128,
    pub current_value: i128,
    pub deposits: i128,
    pub earned_interest: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinancingRequest {
    pub id: u64,
    pub borrower: Address,
    pub invoice_id: String,
    pub invoice_amount: i128,
    pub borrow_amount: i128,
    pub repayment_amount: i128,
    pub due_date: u64,
    pub status: RequestStatus,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    TokenAddress,
    Pool,
    RequestCounter,
    Investor(Address),
    Request(u64),
}

fn require_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Admin) {
        panic!("contract not initialized")
    }
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("admin missing"))
}

fn read_pool(env: &Env) -> PoolInfo {
    env.storage().instance().get(&DataKey::Pool).unwrap_or(PoolInfo {
        total_liquidity: 0,
        available_liquidity: 0,
        total_shares: 0,
        total_loans: 0,
        outstanding_loans: 0,
    })
}

fn write_pool(env: &Env, pool: &PoolInfo) {
    env.storage().instance().set(&DataKey::Pool, pool);
}

fn read_request_counter(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::RequestCounter)
        .unwrap_or(0)
}

fn write_request_counter(env: &Env, counter: &u64) {
    env.storage().instance().set(&DataKey::RequestCounter, counter);
}

fn read_request(env: &Env, request_id: u64) -> FinancingRequest {
    env.storage()
        .instance()
        .get(&DataKey::Request(request_id))
        .unwrap_or_else(|| panic!("request not found"))
}

fn write_request(env: &Env, request: &FinancingRequest) {
    env.storage()
        .instance()
        .set(&DataKey::Request(request.id), request);
}

fn read_investor_position(env: &Env, investor: &Address) -> InvestorPosition {
    env.storage()
        .instance()
        .get(&DataKey::Investor(investor.clone()))
        .unwrap_or(InvestorPosition {
            shares_owned: 0,
            current_value: 0,
            deposits: 0,
            earned_interest: 0,
        })
}

fn write_investor_position(env: &Env, investor: &Address, position: &InvestorPosition) {
    env.storage()
        .instance()
        .set(&DataKey::Investor(investor.clone()), position);
}

fn hydrate_investor_position(env: &Env, investor: &Address) -> InvestorPosition {
    let mut position = read_investor_position(env, investor);
    let pool = read_pool(env);

    position.current_value = if pool.total_shares == 0 {
        0
    } else {
        position.shares_owned * pool.total_liquidity / pool.total_shares
    };
    position.earned_interest = position.current_value - position.deposits;

    position
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
        write_pool(
            &env,
            &PoolInfo {
                total_liquidity: 0,
                available_liquidity: 0,
                total_shares: 0,
                total_loans: 0,
                outstanding_loans: 0,
            },
        );
        write_request_counter(&env, &0);
    }

    pub fn deposit(env: Env, investor: Address, amount: i128) {
        require_initialized(&env);
        investor.require_auth();

        if amount <= 0 {
            panic!("amount must be positive")
        }

        let mut pool = read_pool(&env);
        let mut position = read_investor_position(&env, &investor);

        let shares_received = if pool.total_shares == 0 || pool.total_liquidity == 0 {
            amount
        } else {
            amount * pool.total_shares / pool.total_liquidity
        };

        position.shares_owned += shares_received;
        position.deposits += amount;
        pool.total_liquidity += amount;
        pool.available_liquidity += amount;
        pool.total_shares += shares_received;

        write_pool(&env, &pool);
        write_investor_position(&env, &investor, &position);
    }

    pub fn withdraw(env: Env, investor: Address, share_amount: i128) -> i128 {
        require_initialized(&env);
        investor.require_auth();

        if share_amount <= 0 {
            panic!("share amount must be positive")
        }

        let mut pool = read_pool(&env);
        let mut position = read_investor_position(&env, &investor);

        if share_amount > position.shares_owned {
            panic!("insufficient investor shares")
        }

        if pool.total_shares == 0 {
            panic!("pool has no shares")
        }

        let withdraw_amount = share_amount * pool.total_liquidity / pool.total_shares;

        if withdraw_amount > pool.available_liquidity {
            panic!("insufficient available liquidity")
        }

        position.shares_owned -= share_amount;
        position.deposits -= withdraw_amount;
        pool.total_liquidity -= withdraw_amount;
        pool.available_liquidity -= withdraw_amount;
        pool.total_shares -= share_amount;

        write_pool(&env, &pool);
        write_investor_position(&env, &investor, &position);

        withdraw_amount
    }

    pub fn create_financing_request(
        env: Env,
        borrower: Address,
        invoice_id: String,
        invoice_amount: i128,
        borrow_amount: i128,
        repayment_amount: i128,
        due_date: u64,
    ) -> u64 {
        require_initialized(&env);
        borrower.require_auth();

        if invoice_amount <= 0 || borrow_amount <= 0 || repayment_amount <= 0 {
            panic!("amounts must be positive")
        }

        if borrow_amount > invoice_amount {
            panic!("borrow exceeds invoice amount")
        }

        if repayment_amount <= borrow_amount {
            panic!("repayment must exceed borrow amount")
        }

        let request_id = read_request_counter(&env) + 1;
        write_request_counter(&env, &request_id);

        write_request(
            &env,
            &FinancingRequest {
                id: request_id,
                borrower,
                invoice_id,
                invoice_amount,
                borrow_amount,
                repayment_amount,
                due_date,
                status: RequestStatus::PendingAdminReview,
            },
        );

        request_id
    }

    pub fn approve_request(env: Env, admin: Address, request_id: u64) {
        require_initialized(&env);
        admin.require_auth();

        if admin != read_admin(&env) {
            panic!("only admin can approve")
        }

        let mut request = read_request(&env, request_id);

        if request.status != RequestStatus::PendingAdminReview {
            panic!("request is not pending")
        }

        request.status = RequestStatus::Approved;
        write_request(&env, &request);
    }

    pub fn reject_request(env: Env, admin: Address, request_id: u64) {
        require_initialized(&env);
        admin.require_auth();

        if admin != read_admin(&env) {
            panic!("only admin can reject")
        }

        let mut request = read_request(&env, request_id);

        if request.status != RequestStatus::PendingAdminReview {
            panic!("request is not pending")
        }

        request.status = RequestStatus::Rejected;
        write_request(&env, &request);
    }

    pub fn borrow(env: Env, borrower: Address, request_id: u64) {
        require_initialized(&env);
        borrower.require_auth();

        let mut request = read_request(&env, request_id);
        let mut pool = read_pool(&env);

        if borrower != request.borrower {
            panic!("borrower mismatch")
        }

        if request.status != RequestStatus::Approved {
            panic!("request is not approved")
        }

        if request.borrow_amount > pool.available_liquidity {
            panic!("insufficient pool liquidity")
        }

        request.status = RequestStatus::Borrowed;
        pool.available_liquidity -= request.borrow_amount;
        pool.outstanding_loans += request.borrow_amount;
        pool.total_loans += 1;

        write_request(&env, &request);
        write_pool(&env, &pool);
    }

    pub fn repay(env: Env, borrower: Address, request_id: u64) {
        require_initialized(&env);
        borrower.require_auth();

        let mut request = read_request(&env, request_id);
        let mut pool = read_pool(&env);

        if borrower != request.borrower {
            panic!("borrower mismatch")
        }

        if request.status != RequestStatus::Borrowed {
            panic!("request is not borrowed")
        }

        request.status = RequestStatus::Repaid;
        pool.available_liquidity += request.repayment_amount;
        pool.outstanding_loans -= request.borrow_amount;
        pool.total_liquidity += request.repayment_amount - request.borrow_amount;

        write_request(&env, &request);
        write_pool(&env, &pool);
    }

    pub fn get_pool_info(env: Env) -> PoolInfo {
        require_initialized(&env);
        read_pool(&env)
    }

    pub fn get_investor_position(env: Env, investor: Address) -> InvestorPosition {
        require_initialized(&env);
        hydrate_investor_position(&env, &investor)
    }

    pub fn get_request(env: Env, request_id: u64) -> FinancingRequest {
        require_initialized(&env);
        read_request(&env, request_id)
    }
}

mod test;
