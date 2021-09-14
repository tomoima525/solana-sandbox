use {
  crate::util::try_from_slice_checked,
  borsh::{BorshDeserialize, BorshSerialize},
  solana_program::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey},
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub enum Key {
  Uninitialized,
  EditionV1,
  MasterEditionV1,
  ReservationListV1,
  MetadataV1,
  ReservationListV2,
  MasterEditionV2,
  EditionMarker,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Creator {
  pub address: Pubkey,
  pub verified: bool,
  // In percentages, NOT basis points ;) Watch out!
  pub share: u8,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Data {
  /// The name of the asset
  pub name: String,
  /// The symbol for the asset
  pub symbol: String,
  /// URI pointing to JSON representing the asset
  pub uri: String,
  /// Royalty basis points that goes to creators in secondary sales (0-10000)
  pub seller_fee_basis_points: u16,
  /// Array of creators, optional
  pub creators: Option<Vec<Creator>>,
}

#[repr(C)]
#[derive(Clone, BorshDeserialize, BorshSerialize, Debug)]
pub struct Metadata {
  pub key: Key,
  pub update_authority: Pubkey,
  pub mint: Pubkey,
  pub data: Data,
  pub primary_sale_happened: bool,
  pub is_mutable: bool,
  pub edition_nonce: Option<u8>,
}

impl Metadata {
  pub fn from_account_info(a: &AccountInfo) -> Result<Metadata, ProgramError> {
    let md: Metadata =
      try_from_slice_checked(&a.data.borrow_mut(), Key::MetadataV1, MAX_METADATA_LEN)?;
    Ok(md)
  }
}

/// Used in seeds to make Edition model pda address
pub const EDITION: &str = "edition";

/// prefix used for PDAs to avoid certain collision attacks (https://en.wikipedia.org/wiki/Collision_attack#Chosen-prefix_collision_attack)
pub const PREFIX: &str = "metadata";

pub const MAX_NAME_LENGTH: usize = 32;

pub const MAX_SYMBOL_LENGTH: usize = 10;

pub const MAX_URI_LENGTH: usize = 200;

pub const MAX_METADATA_LEN: usize = 1
  + 32
  + 32
  + 4
  + MAX_NAME_LENGTH
  + 4
  + MAX_SYMBOL_LENGTH
  + 4
  + MAX_URI_LENGTH
  + 2
  + 1
  + 4
  + MAX_CREATOR_LIMIT * MAX_CREATOR_LEN
  + 1
  + 1
  + 9
  + 172;

pub const MAX_CREATOR_LIMIT: usize = 5;

pub const MAX_CREATOR_LEN: usize = 32 + 1 + 1;
