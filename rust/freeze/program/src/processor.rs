use crate::{
  error::TokenError,
  instruction::{FreezeInstruction, MAX_SIGNERS},
  state::{Account, AccountState, Mint, Multisig},
};
use num_traits::FromPrimitive;
use solana_program::{
  account_info::{next_account_info, AccountInfo},
  decode_error::DecodeError,
  entrypoint::ProgramResult,
  msg,
  program_error::{PrintProgramError, ProgramError},
  program_option::COption,
  program_pack::Pack,
  pubkey::Pubkey,
};

pub struct Processor {}

impl Processor {
  /// Processes a [FreezeAccount](enum.TokenInstruction.html) or a
  /// [ThawAccount](enum.TokenInstruction.html) instruction.
  pub fn process_toggle_freeze_account(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    freeze: bool,
  ) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let source_account_info = next_account_info(account_info_iter)?;
    let mint_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;

    let mut source_account: Account = Account::unpack(&source_account_info.data.borrow())?;
    msg!(
      "source  frozen? {}, native? {}",
      source_account.is_frozen(),
      source_account.is_native()
    );
    if freeze && source_account.is_frozen() || !freeze && !source_account.is_frozen() {
      return Err(TokenError::InvalidState.into());
    }
    if source_account.is_native() {
      return Err(TokenError::NativeNotSupported.into());
    }
    if mint_info.key != &source_account.mint {
      return Err(TokenError::MintMismatch.into());
    }

    let mint = Mint::unpack(&mint_info.data.borrow_mut())?;
    msg!("freeze authority {:?}", mint.freeze_authority);
    match mint.freeze_authority {
      COption::Some(authority) => Self::validate_owner(
        program_id,
        &authority,
        authority_info,
        account_info_iter.as_slice(),
      ),
      COption::None => Err(TokenError::MintCannotFreeze.into()),
    }?;

    source_account.state = if freeze {
      AccountState::Frozen
    } else {
      AccountState::Initialized
    };

    Account::pack(source_account, &mut source_account_info.data.borrow_mut())?;

    Ok(())
  }

  /// Processes an [Instruction](enum.Instruction.html).
  pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], input: &[u8]) -> ProgramResult {
    let instruction = FreezeInstruction::unpack(input)?;

    match instruction {
      FreezeInstruction::FreezeAccount => {
        msg!("Instruction: FreezeAccount");
        Self::process_toggle_freeze_account(program_id, accounts, true)
      }
      FreezeInstruction::ThawAccount => {
        msg!("Instruction: ThawAccount");
        Self::process_toggle_freeze_account(program_id, accounts, false)
      }
    }
  }

  pub fn validate_owner(
    program_id: &Pubkey,
    expected_owner: &Pubkey,
    owner_account_info: &AccountInfo,
    signers: &[AccountInfo],
  ) -> ProgramResult {
    if expected_owner != owner_account_info.key {
      return Err(TokenError::OwnerMismatch.into());
    }
    if program_id == owner_account_info.owner
      && owner_account_info.data_len() == Multisig::get_packed_len()
    {
      let multisig = Multisig::unpack(&owner_account_info.data.borrow())?;
      let mut num_signers = 0;
      let mut matched = [false; MAX_SIGNERS];
      for signer in signers.iter() {
        for (position, key) in multisig.signers[0..multisig.n as usize].iter().enumerate() {
          if key == signer.key && !matched[position] {
            if !signer.is_signer {
              return Err(ProgramError::MissingRequiredSignature);
            }
            matched[position] = true;
            num_signers += 1;
          }
        }
      }
      if num_signers < multisig.m {
        return Err(ProgramError::MissingRequiredSignature);
      }
      return Ok(());
    } else if !owner_account_info.is_signer {
      return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
  }
}

impl PrintProgramError for TokenError {
  fn print<E>(&self)
  where
    E: 'static + std::error::Error + DecodeError<E> + PrintProgramError + FromPrimitive,
  {
    match self {
      TokenError::NotRentExempt => msg!("Error: Lamport balance below rent-exempt threshold"),
      TokenError::InsufficientFunds => msg!("Error: insufficient funds"),
      TokenError::InvalidMint => msg!("Error: Invalid Mint"),
      TokenError::MintMismatch => msg!("Error: Account not associated with this Mint"),
      TokenError::OwnerMismatch => msg!("Error: owner does not match"),
      TokenError::FixedSupply => msg!("Error: the total supply of this token is fixed"),
      TokenError::AlreadyInUse => msg!("Error: account or token already in use"),
      TokenError::InvalidNumberOfProvidedSigners => {
        msg!("Error: Invalid number of provided signers")
      }
      TokenError::InvalidNumberOfRequiredSigners => {
        msg!("Error: Invalid number of required signers")
      }
      TokenError::UninitializedState => msg!("Error: State is uninitialized"),
      TokenError::NativeNotSupported => {
        msg!("Error: Instruction does not support native tokens")
      }
      TokenError::NonNativeHasBalance => {
        msg!("Error: Non-native account can only be closed if its balance is zero")
      }
      TokenError::InvalidInstruction => msg!("Error: Invalid instruction"),
      TokenError::InvalidState => msg!("Error: Invalid account state for operation"),
      TokenError::Overflow => msg!("Error: Operation overflowed"),
      TokenError::AuthorityTypeNotSupported => {
        msg!("Error: Account does not support specified authority type")
      }
      TokenError::MintCannotFreeze => msg!("Error: This token mint cannot freeze accounts"),
      TokenError::AccountFrozen => msg!("Error: Account is frozen"),
      TokenError::MintDecimalsMismatch => {
        msg!("Error: decimals different from the Mint decimals")
      }
    }
  }
}
