#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, IntoVal, String};

fn setup() -> (
    Env,
    Address,
    ContractClient<'static>,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    Address,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let investor_one = Address::generate(&env);
    let investor_two = Address::generate(&env);
    let supplier = Address::generate(&env);
    let customer = Address::generate(&env);
    let outsider = Address::generate(&env);

    let stellar_asset = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = stellar_asset.address();
    let token_client = token::Client::new(&env, &token_address);
    let asset_admin = token::StellarAssetClient::new(&env, &token_address);

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token_address);

    (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        admin,
        investor_one,
        investor_two,
        supplier,
        customer,
        outsider,
    )
}

fn approve(
    env: &Env,
    token_client: &token::Client,
    owner: &Address,
    spender: &Address,
    amount: i128,
) {
    token_client.approve(
        owner,
        spender,
        &amount,
        &(env.ledger().sequence() + 1_000).into_val(env),
    );
}

#[test]
fn token_backed_financing_lifecycle_and_fee_distribution() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        admin,
        investor,
        _second_investor,
        supplier,
        customer,
        _outsider,
    ) = setup();

    asset_admin.mint(&investor, &10_000_i128);
    asset_admin.mint(&customer, &10_000_i128);

    approve(&env, &token_client, &investor, &contract_id, 10_000);
    let minted_shares = client.deposit(&investor, &10_000_i128);
    assert_eq!(minted_shares, 10_000);
    assert_eq!(token_client.balance(&investor), 0);
    assert_eq!(token_client.balance(&contract_id), 10_000);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-2026-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);

    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.approve_financing(&admin, &request_id);
    client.borrow(&supplier, &request_id);

    let funded_request = client.get_financing_request(&request_id);
    assert_eq!(funded_request.status, FinancingStatus::Active);
    assert_eq!(funded_request.principal_amount, 8_000);
    assert_eq!(token_client.balance(&supplier), 8_000);
    assert_eq!(token_client.balance(&contract_id), 2_000);

    let borrowed_pool = client.get_pool_info();
    assert_eq!(borrowed_pool.total_liquidity, 10_000);
    assert_eq!(borrowed_pool.available_liquidity, 2_000);
    assert_eq!(borrowed_pool.total_outstanding_principal, 8_000);

    approve(&env, &token_client, &customer, &contract_id, 10_000);
    let settlement = client.settle_invoice(&customer, &request_id);
    assert_eq!(
        settlement,
        SettlementBreakdown {
            invoice_amount: 10_000,
            principal_recovered: 8_000,
            interest_recovered: 800,
            processing_fee_recovered: 240,
            supplier_surplus: 960,
        }
    );

    let settled_pool = client.get_pool_info();
    assert_eq!(settled_pool.total_liquidity, 10_800);
    assert_eq!(settled_pool.available_liquidity, 10_800);
    assert_eq!(settled_pool.total_platform_fees, 240);
    assert_eq!(settled_pool.total_interest_earned, 800);
    assert_eq!(settled_pool.total_outstanding_principal, 0);

    assert_eq!(token_client.balance(&supplier), 8_960);
    assert_eq!(token_client.balance(&contract_id), 11_040);

    let investor_position = client.get_investor_position(&investor);
    assert_eq!(
        investor_position,
        InvestorPosition {
            investor_shares: 10_000,
            estimated_withdrawable_amount: 10_800,
            pool_share_bps: 10_000,
        }
    );

    let withdrawn_amount = client.withdraw(&investor, &10_000_i128);
    assert_eq!(withdrawn_amount, 10_800);
    assert_eq!(token_client.balance(&investor), 10_800);
    assert_eq!(token_client.balance(&contract_id), 240);

    client.withdraw_platform_fees(&admin, &240_i128);
    assert_eq!(token_client.balance(&admin), 240);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn second_investor_receives_proportional_shares() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        admin,
        investor_one,
        investor_two,
        supplier,
        customer,
        _outsider,
    ) = setup();

    asset_admin.mint(&investor_one, &100_000_i128);
    asset_admin.mint(&investor_two, &54_000_i128);
    asset_admin.mint(&customer, &100_000_i128);

    approve(&env, &token_client, &investor_one, &contract_id, 100_000);
    let first_shares = client.deposit(&investor_one, &100_000_i128);
    assert_eq!(first_shares, 100_000);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-2026-002"),
        &50_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.approve_financing(&admin, &request_id);
    client.borrow(&supplier, &request_id);

    approve(&env, &token_client, &customer, &contract_id, 50_000);
    client.settle_invoice(&customer, &request_id);

    let pool_after_yield = client.get_pool_info();
    assert_eq!(pool_after_yield.total_liquidity, 104_000);
    assert_eq!(pool_after_yield.total_shares, 100_000);

    approve(&env, &token_client, &investor_two, &contract_id, 54_000);
    let second_shares = client.deposit(&investor_two, &52_000_i128);
    assert_eq!(second_shares, 50_000);

    let investor_two_position = client.get_investor_position(&investor_two);
    assert_eq!(
        investor_two_position,
        InvestorPosition {
            investor_shares: 50_000,
            estimated_withdrawable_amount: 52_000,
            pool_share_bps: 3_333,
        }
    );

    let updated_pool = client.get_pool_info();
    assert_eq!(updated_pool.total_liquidity, 156_000);
    assert_eq!(updated_pool.total_shares, 150_000);
}

#[test]
fn admin_can_reject_pending_request() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        admin,
        investor,
        _second_investor,
        supplier,
        customer,
        _outsider,
    ) = setup();

    asset_admin.mint(&investor, &15_000_i128);
    approve(&env, &token_client, &investor, &contract_id, 15_000);
    client.deposit(&investor, &15_000_i128);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-REJECT-001"),
        &12_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);

    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.reject_financing(&admin, &request_id);

    let request = client.get_financing_request(&request_id);
    assert_eq!(request.status, FinancingStatus::Rejected);
    assert_eq!(
        client.get_invoice(&invoice_id).status,
        InvoiceStatus::Verified
    );
}

#[test]
#[should_panic(expected = "invoice must be verified")]
fn cannot_finance_unverified_invoice() {
    let (
        env,
        _contract_id,
        client,
        _token_client,
        _asset_admin,
        _admin,
        _investor,
        _second,
        supplier,
        customer,
        _outsider,
    ) = setup();
    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-PENDING-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );

    client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
}

#[test]
#[should_panic(expected = "request is not approved")]
fn cannot_borrow_before_approval() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        _admin,
        investor,
        _second_investor,
        supplier,
        customer,
        _outsider,
    ) = setup();

    asset_admin.mint(&investor, &10_000_i128);
    approve(&env, &token_client, &investor, &contract_id, 10_000);
    client.deposit(&investor, &10_000_i128);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-NO-APPROVAL"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);

    client.borrow(&supplier, &request_id);
}

#[test]
#[should_panic(expected = "insufficient liquidity")]
fn cannot_borrow_if_pool_liquidity_is_insufficient() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        admin,
        investor,
        _second_investor,
        supplier,
        customer,
        _outsider,
    ) = setup();

    asset_admin.mint(&investor, &5_000_i128);
    approve(&env, &token_client, &investor, &contract_id, 5_000);
    client.deposit(&investor, &5_000_i128);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-LOW-LIQ"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.approve_financing(&admin, &request_id);

    client.borrow(&supplier, &request_id);
}

#[test]
#[should_panic(expected = "request is not active")]
fn cannot_settle_twice() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        admin,
        investor,
        _second_investor,
        supplier,
        customer,
        _outsider,
    ) = setup();

    asset_admin.mint(&investor, &10_000_i128);
    asset_admin.mint(&customer, &10_000_i128);

    approve(&env, &token_client, &investor, &contract_id, 10_000);
    client.deposit(&investor, &10_000_i128);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-SETTLED-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.approve_financing(&admin, &request_id);
    client.borrow(&supplier, &request_id);

    approve(&env, &token_client, &customer, &contract_id, 10_000);
    client.settle_invoice(&customer, &request_id);

    client.settle_invoice(&customer, &request_id);
}

#[test]
#[should_panic(expected = "only admin allowed")]
fn unauthorized_user_cannot_approve_financing() {
    let (
        env,
        contract_id,
        client,
        token_client,
        asset_admin,
        _admin,
        investor,
        _second_investor,
        supplier,
        customer,
        outsider,
    ) = setup();

    asset_admin.mint(&investor, &10_000_i128);
    approve(&env, &token_client, &investor, &contract_id, 10_000);
    client.deposit(&investor, &10_000_i128);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-ADMIN-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id =
        client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);

    client.approve_financing(&outsider, &request_id);
}
