use {
  crate::error::TokenError,
  borsh::{BorshDeserialize, BorshSerialize},
  solana_program::{msg, program_error::ProgramError},
  std::mem::size_of,
};

/// Minimum number of multisignature signers (min N)
pub const MIN_SIGNERS: usize = 1;
/// Maximum number of multisignature signers (max N)
pub const MAX_SIGNERS: usize = 11;

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum FreezeInstruction {
  /// Freeze an Initialized account using the Mint's freeze_authority (if
  /// set).
  ///
  /// Accounts expected by this instruction:
  ///
  ///   * Single owner
  ///   0. `[writable]` The account to freeze.
  ///   1. `[]` The token mint.
  ///   2. `[signer]` The mint freeze authority.
  ///
  ///   * Multisignature owner
  ///   0. `[writable]` The account to freeze.
  ///   1. `[]` The token mint.
  ///   2. `[]` The mint's multisignature freeze authority.
  ///   3. ..3+M `[signer]` M signer accounts.
  FreezeAccount,
  /// Thaw a Frozen account using the Mint's freeze_authority (if set).
  ///
  /// Accounts expected by this instruction:
  ///
  ///   * Single owner
  ///   0. `[writable]` The account to freeze.
  ///   1. `[]` The token mint.
  ///   2. `[signer]` The mint freeze authority.
  ///
  ///   * Multisignature owner
  ///   0. `[writable]` The account to freeze.
  ///   1. `[]` The token mint.
  ///   2. `[]` The mint's multisignature freeze authority.
  ///   3. ..3+M `[signer]` M signer accounts.
  ThawAccount,
}

impl FreezeInstruction {
  /// Unpacks a byte buffer into a [TokenInstruction](enum.TokenInstruction.html).
  pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
    let (&tag, _rest) = input.split_first().ok_or(TokenError::InvalidInstruction)?;
    msg!("Tag {}", tag);
    Ok(match tag {
      0 => Self::FreezeAccount,
      1 => Self::ThawAccount,
      _ => return Err(TokenError::InvalidInstruction.into()),
    })
  }

  /// Packs a [TokenInstruction](enum.TokenInstruction.html) into a byte buffer.
  pub fn pack(&self) -> Vec<u8> {
    let mut buf = Vec::with_capacity(size_of::<Self>());
    match self {
      Self::FreezeAccount => buf.push(0),
      Self::ThawAccount => buf.push(1),
    };
    buf
  }
}

/// Utility function that checks index is between MIN_SIGNERS and MAX_SIGNERS
pub fn is_valid_signer_index(index: usize) -> bool {
  (MIN_SIGNERS..=MAX_SIGNERS).contains(&index)
}

#[repr(u8)]
#[derive(Clone, Debug, PartialEq)]
pub enum AuthorityType {
  /// Authority to mint new tokens
  MintTokens,
  /// Authority to freeze any account associated with the Mint
  FreezeAccount,
  /// Owner of a given token account
  AccountOwner,
  /// Authority to close a token account
  CloseAccount,
}
