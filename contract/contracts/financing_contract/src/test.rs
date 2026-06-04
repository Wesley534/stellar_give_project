#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, ContractClient<'static>, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let treasury = Address::generate(&env);
    let investor = Address::generate(&env);
    let supplier = Address::generate(&env);
    let customer = Address::generate(&env);

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token_address, &treasury);

    (env, client, admin, investor, supplier, customer, treasury)
}

#[test]
fn financing_lifecycle_and_profit_distribution() {
    let (env, client, admin, investor, supplier, customer, _treasury) = setup();

    let deposit_hash =
        String::from_str(&env, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    let shares = client.record_xlm_deposit(&investor, &10_000_i128, &10_000_i128, &deposit_hash);
    assert_eq!(shares, 10_000);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-2026-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);

    let request_id = client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.approve_financing(&admin, &request_id);
    client.borrow(&supplier, &request_id);

    let funded_request = client.get_financing_request(&request_id);
    assert_eq!(funded_request.status, FinancingStatus::Active);

    let funded_invoice = client.get_invoice(&invoice_id);
    assert_eq!(funded_invoice.status, InvoiceStatus::Funded);

    let borrowed_pool = client.get_pool_info();
    assert_eq!(borrowed_pool.total_liquidity, 10_000);
    assert_eq!(borrowed_pool.available_liquidity, 2_000);

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

    let investor_position = client.get_investor_position(&investor);
    assert_eq!(investor_position.current_value, 10_800);
    assert_eq!(investor_position.earned_interest, 800);

    let withdrawn_amount = client.withdraw_liquidity(&investor, &10_000_i128);
    assert_eq!(withdrawn_amount, 10_800);
}

#[test]
fn simulate_fiat_deposit_and_withdrawal_work() {
    let (_env, client, _admin, investor, _supplier, _customer, _treasury) = setup();

    let shares = client.simulate_fiat_deposit(&investor, &200_000_i128, &10_000_i128);
    assert_eq!(shares, 10_000);

    let position = client.get_investor_position(&investor);
    assert_eq!(position.shares, 10_000);
    assert_eq!(position.deposited_amount, 10_000);

    let withdrawn = client.withdraw_liquidity(&investor, &4_000_i128);
    assert_eq!(withdrawn, 4_000);
}

#[test]
fn admin_can_reject_pending_request() {
    let (env, client, admin, investor, supplier, customer, _treasury) = setup();

    let deposit_hash =
        String::from_str(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    client.record_xlm_deposit(&investor, &15_000_i128, &15_000_i128, &deposit_hash);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-REJECT-001"),
        &12_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);

    let request_id = client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.reject_financing(&admin, &request_id);

    let request = client.get_financing_request(&request_id);
    assert_eq!(request.status, FinancingStatus::Rejected);
    assert_eq!(client.get_invoice(&invoice_id).status, InvoiceStatus::Verified);
}

#[test]
#[should_panic(expected = "invoice must be verified")]
fn cannot_finance_unverified_invoice() {
    let (env, client, _admin, _investor, supplier, customer, _treasury) = setup();
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
    let (env, client, _admin, investor, supplier, customer, _treasury) = setup();
    let deposit_hash =
        String::from_str(&env, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    client.record_xlm_deposit(&investor, &10_000_i128, &10_000_i128, &deposit_hash);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-NO-APPROVAL"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id = client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);

    client.borrow(&supplier, &request_id);
}

#[test]
#[should_panic(expected = "request is not active")]
fn cannot_settle_twice() {
    let (env, client, admin, investor, supplier, customer, _treasury) = setup();
    let deposit_hash =
        String::from_str(&env, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");
    client.record_xlm_deposit(&investor, &10_000_i128, &10_000_i128, &deposit_hash);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-SETTLED-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id = client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);
    client.approve_financing(&admin, &request_id);
    client.borrow(&supplier, &request_id);
    client.settle_invoice(&customer, &request_id);

    client.settle_invoice(&customer, &request_id);
}

#[test]
#[should_panic(expected = "only admin allowed")]
fn non_admin_cannot_approve_financing() {
    let (env, client, _admin, investor, supplier, customer, _treasury) = setup();
    let deposit_hash =
        String::from_str(&env, "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd");
    client.record_xlm_deposit(&investor, &10_000_i128, &10_000_i128, &deposit_hash);

    let invoice_id = client.create_invoice(
        &supplier,
        &customer,
        &String::from_str(&env, "INV-ADMIN-001"),
        &10_000_i128,
        &1_750_000_000_u64,
    );
    client.verify_invoice(&customer, &invoice_id);
    let request_id = client.request_financing(&supplier, &invoice_id, &8_000_u32, &1_000_u32, &300_u32);

    client.approve_financing(&supplier, &request_id);
}
