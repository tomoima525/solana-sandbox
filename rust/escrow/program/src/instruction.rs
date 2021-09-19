use {
  crate::{error::EscrowError::InvalidInstruction, state::EscrowReceive},
  borsh::{BorshDeserialize, BorshSerialize},
  solana_program::program_error::ProgramError,
  std::convert::TryInto,
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct InitEscrowArgs {
  pub data: EscrowReceive,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum EscrowInstruction {
  /// Starts the trade by creating and populating escrow account
  /// 0. `[signer]` The account initializing the escrow. Transferring the ownership of the temporary account requires Initializer's signature.
  /// 1. `[writable]` Temporary token account for escrow
  /// 2. `[]` Token account of receiving token from the other
  /// 3. `[writable]` escrow account
  /// 4. `[]` Rent sysvar(An account that provides cluster info. In this case check if other account are rent exempt)
  /// 5. `[]` The token prograrm
  InitEscrow { amount: u64 },

  /// Accept trade
  /// 0. `[signer]` The account of the person taking the trade
  /// 1. `[writable]` The taker's token account for the token they send
  /// 2. `[writable]` The taker's token account for the token they will receive should the trade go through
  /// 3. `[writable]` The PDA's temp token account to get tokens from and eventually close
  /// 4. `[writable]` The initializer's main account to send their rent fees to
  /// 5. `[writable]` The initializer's token account that will receive tokens
  /// 6. `[writable]` The escrow account holding the escrow info
  /// 7. `[]` The token program
  /// 8. `[]` The PDA account
  Exchange { amount: u64 },
}

impl EscrowInstruction {
  pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
    let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

    Ok(match tag {
      0 => Self::InitEscrow {
        amount: Self::unpack_amount(rest)?,
      },
      1 => Self::Exchange {
        amount: Self::unpack_amount(rest)?,
      },
      _ => return Err(InvalidInstruction.into()),
    })
  }

  pub fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
    let amount = input
      .get(..8)
      .and_then(|slice| slice.try_into().ok())
      .map(u64::from_le_bytes)
      .ok_or(InvalidInstruction)?;
    Ok(amount)
  }
}
