use {
  crate::state::{Creator, Data},
  borsh::{BorshDeserialize, BorshSerialize},
  solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    sysvar,
  },
};

/// Define the type of state stored in accounts
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct CreateMetadataAccountArgs {
  pub data: Data,
  pub is_mutable: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum MetadataInstruction {
  CreateMetadataAccount(CreateMetadataAccountArgs),
}

#[allow(clippy::too_many_arguments)]
pub fn create_metadata_accounts(
  program_id: Pubkey,
  metadata_account: Pubkey,
  mint: Pubkey,
  mint_authority: Pubkey,
  payer: Pubkey,
  update_authority: Pubkey,
  name: String,
  symbol: String,
  uri: String,
  creators: Option<Vec<Creator>>,
  seller_fee_basis_points: u16,
  update_authority_is_signer: bool,
  is_mutable: bool,
) -> Instruction {
  Instruction {
    program_id,
    accounts: vec![
      AccountMeta::new(metadata_account, false),
      AccountMeta::new_readonly(mint, false),
      AccountMeta::new_readonly(mint_authority, true),
      AccountMeta::new_readonly(payer, true),
      AccountMeta::new_readonly(update_authority, update_authority_is_signer),
      AccountMeta::new_readonly(solana_program::system_program::id(), false),
      AccountMeta::new_readonly(sysvar::rent::id(), false),
    ],
    data: MetadataInstruction::CreateMetadataAccount(CreateMetadataAccountArgs {
      data: Data {
        name,
        symbol,
        uri,
        seller_fee_basis_points,
        creators,
      },
      is_mutable,
    })
    .try_to_vec()
    .unwrap(),
  }
}
