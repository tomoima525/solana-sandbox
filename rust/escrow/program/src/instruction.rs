use {
  crate::state::EscrowReceive,
  borsh::{BorshDeserialize, BorshSerialize},
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct InitEscrowArgs {
  pub data: EscrowReceive,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum EscrowInstruction {
  /// Starts the trade by creating and populating escrow account
  /// 0. `[signer]` The account initializing the escrow
  /// 1. `[writable]` Temporary token account for escrow
  /// 2. `[]` Token account of receiving token
  /// 3. `[writable]` escrow account
  /// 4. `[]` System program
  /// 5. `[]` Rent info
  InitEscrow(InitEscrowArgs),
}