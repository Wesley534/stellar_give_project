#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn financing_lifecycle_and_profit_distribution() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let investor_a = Address::generate(&env);
    let investor_b = Address::generate(&env);
    let borrower = Address::generate(&env);

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token_address);

    client.deposit(&investor_a, &5_000_i128);
    client.deposit(&investor_b, &5_000_i128);

    let request_id = client.create_financing_request(
        &borrower,
        &String::from_str(&env, "INV-2026-001"),
        &10_000_i128,
        &8_000_i128,
        &8_800_i128,
        &1_750_000_000_u64,
    );

    client.approve_request(&admin, &request_id);
    client.borrow(&borrower, &request_id);

    let borrowed_pool = client.get_pool_info();
    assert_eq!(
        borrowed_pool,
        PoolInfo {
            total_liquidity: 10_000,
            available_liquidity: 2_000,
            total_shares: 10_000,
            total_loans: 1,
            outstanding_loans: 8_000,
        }
    );

    client.repay(&borrower, &request_id);

    let repaid_pool = client.get_pool_info();
    assert_eq!(
        repaid_pool,
        PoolInfo {
            total_liquidity: 10_800,
            available_liquidity: 10_800,
            total_shares: 10_000,
            total_loans: 1,
            outstanding_loans: 0,
        }
    );

    let investor_a_position = client.get_investor_position(&investor_a);
    assert_eq!(
        investor_a_position,
        InvestorPosition {
            shares_owned: 5_000,
            current_value: 5_400,
            deposits: 5_000,
            earned_interest: 400,
        }
    );

    let withdrawn_amount = client.withdraw(&investor_a, &5_000_i128);
    assert_eq!(withdrawn_amount, 5_400);

    let final_pool = client.get_pool_info();
    assert_eq!(
        final_pool,
        PoolInfo {
            total_liquidity: 5_400,
            available_liquidity: 5_400,
            total_shares: 5_000,
            total_loans: 1,
            outstanding_loans: 0,
        }
    );
}

#[test]
fn admin_can_reject_pending_request() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let borrower = Address::generate(&env);

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token_address);

    let request_id = client.create_financing_request(
        &borrower,
        &String::from_str(&env, "INV-REJECT-001"),
        &12_000_i128,
        &9_000_i128,
        &9_900_i128,
        &1_750_000_000_u64,
    );

    client.reject_request(&admin, &request_id);

    let request = client.get_request(&request_id);
    assert_eq!(request.status, RequestStatus::Rejected);
}
