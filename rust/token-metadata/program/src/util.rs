use {
  crate::{error::MetadataError, state::Key},
  borsh::BorshDeserialize,
  solana_program::{borsh::try_from_slice_unchecked, program_error::ProgramError},
};

pub fn try_from_slice_checked<T: BorshDeserialize>(
  data: &[u8],
  data_type: Key,
  data_size: usize,
) -> Result<T, ProgramError> {
  if (data[0] != data_type as u8 && data[0] != Key::Uninitialized as u8) || data.len() != data_size
  {
    return Err(MetadataError::DataTypeMismatch.into());
  }

  let result: T = try_from_slice_unchecked(data)?;
  Ok(result)
}
