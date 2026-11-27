use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Axg5mp8n16EGYXEmXVZD4XM3YT2jjsypH2Ep5tJKwaEF");

#[constant]
pub const LAMPORTS_PER_PESO: u64 = 1_000;
pub const MAX_PHARMACIES: usize = 3;
pub const MAX_PRODUCTS: usize = 10;
pub const HISTORY_LEN: usize = 10;
#[constant]
pub const POLICY_SEED: &[u8] = b"policy";

#[program]
pub mod remedio_seguro {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        policy_seed: u64,
        agent: Pubkey,
        per_purchase_cap: u64,
        period_budget: u64,
        period_seconds: i64,
        pharmacies: Vec<Pubkey>,
        products: Vec<[u8; 32]>,
        deposit_pesos: u64,
    ) -> Result<()> {
        require!(
            pharmacies.len() <= MAX_PHARMACIES,
            RemedioError::TooManyPharmacies
        );
        require!(
            products.len() <= MAX_PRODUCTS,
            RemedioError::TooManyProducts
        );
        require!(period_seconds > 0, RemedioError::InvalidPeriod);

        let policy = &mut ctx.accounts.policy;
        policy.family = ctx.accounts.family.key();
        policy.agent = agent;
        policy.policy_seed = policy_seed;
        policy.per_purchase_cap = per_purchase_cap;
        policy.period_budget = period_budget;
        policy.period_seconds = period_seconds;
        policy.period_start = Clock::get()?.unix_timestamp;
        policy.spent_in_period = 0;
        policy.paused = false;
        policy.pharmacies = [Pubkey::default(); MAX_PHARMACIES];
        policy.pharmacies[..pharmacies.len()].copy_from_slice(&pharmacies);
        policy.products = [[0u8; 32]; MAX_PRODUCTS];
        policy.products[..products.len()].copy_from_slice(&products);
        policy.history = [Purchase::default(); HISTORY_LEN];
        policy.purchase_count = 0;
        policy.bump = ctx.bumps.policy;

        if deposit_pesos > 0 {
            let lamports = deposit_pesos
                .checked_mul(LAMPORTS_PER_PESO)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            system_program::transfer(
                CpiContext::new(
                    system_program::ID,
                    system_program::Transfer {
                        from: ctx.accounts.family.to_account_info(),
                        to: ctx.accounts.policy.to_account_info(),
                    },
                ),
                lamports,
            )?;
        }
        Ok(())
    }

    pub fn agent_pay(
        ctx: Context<AgentPay>,
        amount: u64,
        product: [u8; 32],
        quote_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let pharmacy_key = ctx.accounts.pharmacy.key();
        let policy = &mut ctx.accounts.policy;

        // The checks follow the order in docs/contracts.md.
        require!(!policy.paused, RemedioError::Paused);
        require_keys_eq!(
            ctx.accounts.agent.key(),
            policy.agent,
            RemedioError::UnauthorizedAgent
        );
        // Empty slots hold the default key or zeros and never match.
        let pharmacy_index = policy
            .pharmacies
            .iter()
            .position(|p| *p != Pubkey::default() && *p == pharmacy_key)
            .ok_or(RemedioError::PharmacyNotAllowed)?;
        let product_index = policy
            .products
            .iter()
            .position(|p| *p != [0u8; 32] && *p == product)
            .ok_or(RemedioError::ProductNotAllowed)?;
        require!(amount > 0, RemedioError::ZeroAmount);
        require!(
            amount <= policy.per_purchase_cap,
            RemedioError::OverPurchaseCap
        );

        let period_end = policy
            .period_start
            .checked_add(policy.period_seconds)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        if now >= period_end {
            policy.period_start = now;
            policy.spent_in_period = 0;
        }
        let new_spent = policy
            .spent_in_period
            .checked_add(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        require!(
            new_spent <= policy.period_budget,
            RemedioError::OverPeriodBudget
        );

        let lamports = amount
            .checked_mul(LAMPORTS_PER_PESO)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Record the purchase before moving lamports.
        let slot = (policy.purchase_count as usize) % HISTORY_LEN;
        policy.spent_in_period = new_spent;
        policy.history[slot] = Purchase {
            amount,
            pharmacy_index: pharmacy_index as u8,
            product_index: product_index as u8,
            timestamp: now,
            quote_hash,
        };
        policy.purchase_count = policy.purchase_count.wrapping_add(1);

        // The policy PDA holds data and is owned by this program, so the
        // lamports move directly instead of through the System Program.
        let policy_info = ctx.accounts.policy.to_account_info();
        let pharmacy_info = ctx.accounts.pharmacy.to_account_info();
        let rent_min = Rent::get()?.minimum_balance(policy_info.data_len());
        let required = lamports
            .checked_add(rent_min)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        require!(
            policy_info.lamports() >= required,
            RemedioError::InsufficientVault
        );
        **policy_info.try_borrow_mut_lamports()? -= lamports;
        **pharmacy_info.try_borrow_mut_lamports()? += lamports;
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.policy.paused = paused;
        Ok(())
    }

    pub fn close_policy(_ctx: Context<ClosePolicy>) -> Result<()> {
        // `close = family` returns every lamport (vault and rent) to family.
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(policy_seed: u64)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub family: Signer<'info>,
    #[account(
        init,
        payer = family,
        space = 8 + Policy::INIT_SPACE,
        seeds = [POLICY_SEED, family.key().as_ref(), &policy_seed.to_le_bytes()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AgentPay<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    // Rules are checked in the handler, in the contract's order, so no
    // `constraint` or `has_one` here.
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    /// CHECK: validated in the handler against `policy.pharmacies`.
    #[account(mut)]
    pub pharmacy: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub family: Signer<'info>,
    #[account(mut, has_one = family)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    #[account(mut)]
    pub family: Signer<'info>,
    #[account(mut, has_one = family, close = family)]
    pub policy: Account<'info, Policy>,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub family: Pubkey,
    pub agent: Pubkey,
    pub policy_seed: u64,
    pub per_purchase_cap: u64,
    pub period_budget: u64,
    pub period_seconds: i64,
    pub period_start: i64,
    pub spent_in_period: u64,
    pub paused: bool,
    pub pharmacies: [Pubkey; MAX_PHARMACIES],
    pub products: [[u8; 32]; MAX_PRODUCTS],
    pub history: [Purchase; HISTORY_LEN],
    pub purchase_count: u32,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct Purchase {
    pub amount: u64,
    pub pharmacy_index: u8,
    pub product_index: u8,
    pub timestamp: i64,
    pub quote_hash: [u8; 32],
}

#[error_code]
pub enum RemedioError {
    #[msg("The policy is paused")]
    Paused,
    #[msg("The signer is not the policy's agent")]
    UnauthorizedAgent,
    #[msg("The pharmacy is not allowed by the policy")]
    PharmacyNotAllowed,
    #[msg("The product is not allowed by the policy")]
    ProductNotAllowed,
    #[msg("The amount must be greater than zero")]
    ZeroAmount,
    #[msg("The amount is over the per-purchase cap")]
    OverPurchaseCap,
    #[msg("The amount is over the period budget")]
    OverPeriodBudget,
    #[msg("The vault cannot pay and keep its rent-exempt minimum")]
    InsufficientVault,
    #[msg("Too many pharmacies")]
    TooManyPharmacies,
    #[msg("Too many products")]
    TooManyProducts,
    #[msg("The period must be longer than zero seconds")]
    InvalidPeriod,
}
