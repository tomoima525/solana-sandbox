use {
  borsh::{BorshDeserialize, BorshSerialize},
  solana_program::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey},
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct EscrowReceive {
  /// The amount Receiver expects to receive
  amount: u64,
}