#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Env, String, Vec, Symbol, symbol_short, Address,
};

// ─── Constants (mirrors stellar.js) ───────────────────────────
// MIN_AMOUNT = 0.1 XLM = 1_000_000 stroops
const MIN_AMOUNT: i128 = 1_000_000;

// MAX_WISH_LENGTH = 100 characters
const MAX_WISH_LENGTH: u32 = 100;

// Storage key
const WISHES: Symbol = symbol_short!("WISHES");

// ─── Data Types ───────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct Wish {
    pub sender: Address,    // mirrors: payment.from  (sender's wallet)
    pub wish: String,       // mirrors: reconstructed wish text from manage_data chunks
    pub amount: i128,       // mirrors: parseFloat(payment.amount) in stroops
    pub created_at: u64,    // mirrors: new Date(tx.created_at)
}

// ─── Contract ─────────────────────────────────────────────────

#[contract]
pub struct WishingWellContract;

#[contractimpl]
impl WishingWellContract {

    /// Make a wish
    /// Mirrors: buildWishTransaction({ senderPublicKey, amountXLM, wishText })
    pub fn make_wish(
        env: Env,
        sender: Address,   // mirrors: senderPublicKey
        wish: String,      // mirrors: wishText (reconstructed from manage_data chunks)
        amount: i128,      // mirrors: amountXLM in stroops (1 XLM = 10_000_000 stroops)
    ) {
        // Require sender to authorize — mirrors: wallet signing the transaction
        sender.require_auth();

        // Validate minimum amount — mirrors: MIN_AMOUNT = '0.1' XLM
        if amount < MIN_AMOUNT {
            panic!("Amount must be at least 0.1 XLM (1000000 stroops)");
        }

        // Validate wish length — mirrors: MAX_WISH_LENGTH = 100
        if wish.len() > MAX_WISH_LENGTH {
            panic!("Wish must be 100 characters or less");
        }

        // Load existing wishes
        let mut wishes: Vec<Wish> = env
            .storage()
            .persistent()
            .get(&WISHES)
            .unwrap_or(Vec::new(&env));

        // Build the wish — mirrors the wish object pushed in fetchWishes()
        let new_wish = Wish {
            sender,
            wish,
            amount,
            created_at: env.ledger().timestamp(), // mirrors: new Date(tx.created_at)
        };

        wishes.push_back(new_wish);

        // Save back to storage
        env.storage().persistent().set(&WISHES, &wishes);
    }

    /// Get all wishes
    /// Mirrors: fetchWishes() — returns all wishes sorted by time (newest first)
    pub fn get_wishes(env: Env) -> Vec<Wish> {
        env.storage()
            .persistent()
            .get(&WISHES)
            .unwrap_or(Vec::new(&env))
    }

    /// Get total number of wishes
    /// Mirrors: wishes.length in the frontend
    pub fn get_wish_count(env: Env) -> u32 {
        let wishes: Vec<Wish> = env
            .storage()
            .persistent()
            .get(&WISHES)
            .unwrap_or(Vec::new(&env));

        wishes.len()
    }

    /// Get total XLM collected in the well
    /// Mirrors: wishes.reduce((sum, w) => sum + w.amount, 0) in frontend
    pub fn get_total_xlm(env: Env) -> i128 {
        let wishes: Vec<Wish> = env
            .storage()
            .persistent()
            .get(&WISHES)
            .unwrap_or(Vec::new(&env));

        let mut total: i128 = 0;
        for wish in wishes.iter() {
            total += wish.amount;
        }
        total
    }

    /// Get top 3 wishes by XLM amount
    /// Mirrors: WishCard rank <= 3 logic (top wishes displayed with ✦ #1 #2 #3)
    pub fn get_top_wishes(env: Env) -> Vec<Wish> {
        let wishes: Vec<Wish> = env
            .storage()
            .persistent()
            .get(&WISHES)
            .unwrap_or(Vec::new(&env));

        // Collect into a sortable structure (max 3)
        let mut top: Vec<Wish> = Vec::new(&env);
        let mut count = 0u32;

        // Simple selection: push up to 3 highest-amount wishes
        // (Soroban Vec doesn't support sort directly, so we do 3 passes)
        let mut used: Vec<u32> = Vec::new(&env);

        for _ in 0..3 {
            let mut best_idx: i64 = -1;
            let mut best_amount: i128 = -1;
            let mut idx: u32 = 0;

            for wish in wishes.iter() {
                if !used.contains(&idx) && wish.amount > best_amount {
                    best_amount = wish.amount;
                    best_idx = idx as i64;
                }
                idx += 1;
            }

            if best_idx >= 0 {
                used.push_back(best_idx as u32);
                top.push_back(wishes.get(best_idx as u32).unwrap());
                count += 1;
            }

            if count >= 3 { break; }
        }

        top
    }
}