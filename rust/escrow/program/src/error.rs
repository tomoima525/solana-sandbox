// inside error.rs
use {solana_program::program_error::ProgramError, thiserror::Error};

#[derive(Error, Debug, Copy, Clone)]
pub enum EscrowError {
  #[error("Invalid Instruction")]
  InvalidInstruction,
  #[error("Rent is not exempt")]
  NotRentExmpt,
  #[error("Expected Amount mismatch")]
  ExpectedAmountMismatch,
  #[error("Amount overflow")]
  AmountOverflow,
}

impl From<EscrowError> for ProgramError {
  fn from(e: EscrowError) -> Self {
    ProgramError::Custom(e as u32)
  }
}
