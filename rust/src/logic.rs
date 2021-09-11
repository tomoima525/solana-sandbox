use {
  crate::{
    error::MetadataError,
    state::{
      Data, Key, Metadata, EDITION, MAX_CREATOR_LIMIT, MAX_METADATA_LEN, MAX_NAME_LENGTH,
      MAX_SYMBOL_LENGTH, MAX_URI_LENGTH, PREFIX,
    },
  },
  arrayref::{array_ref, array_refs},
  borsh::BorshSerialize,
  solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_option::COption,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
  },
  spl_token,
  std::convert::TryInto,
};

fn assert_mint_authority_matches_mint(
  mint_authority: &COption<Pubkey>,
  mint_authority_info: &AccountInfo,
) -> ProgramResult {
  match mint_authority {
    COption::None => return Err(MetadataError::InvalidMintAuthority.into()),
    COption::Some(key) => {
      if mint_authority_info.key != key {
        return Err(MetadataError::InvalidMintAuthority.into());
      }
    }
  }
  if !mint_authority_info.is_signer {
    return Err(MetadataError::NotMintAuthority.into());
  }
  Ok(())
}

pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> ProgramResult {
  if account.owner != owner {
    Err(MetadataError::IncorrectOwner.into())
  } else {
    Ok(())
  }
}

fn unpack_coption_key(src: &[u8; 36]) -> Result<COption<Pubkey>, ProgramError> {
  let (tag, body) = array_refs![src, 4, 32];
  match *tag {
    [0, 0, 0, 0] => Ok(COption::None),
    [1, 0, 0, 0] => Ok(COption::Some(Pubkey::new_from_array(*body))),
    _ => Err(ProgramError::InvalidAccountData),
  }
}

pub fn get_mint_authority(account_info: &AccountInfo) -> Result<COption<Pubkey>, ProgramError> {
  let data = account_info.try_borrow_data().unwrap();
  let authority_bytes = array_ref![data, 0, 36];
  Ok(unpack_coption_key(&authority_bytes)?)
}

#[inline(always)]
fn create_or_allocate_account_raw<'a>(
  program_id: Pubkey,
  new_account_info: &AccountInfo<'a>,
  rent_sysvar_info: &AccountInfo<'a>,
  system_program_info: &AccountInfo<'a>,
  payer_info: &AccountInfo<'a>,
  size: usize,
  signer_seeds: &[&[u8]],
) -> ProgramResult {
  let rent = &Rent::from_account_info(rent_sysvar_info)?;
  let required_lamports = rent
    .minimum_balance(size)
    .max(1)
    .saturating_sub(new_account_info.lamports());

  if required_lamports > 0 {
    invoke(
      &system_instruction::transfer(&payer_info.key, new_account_info.key, required_lamports),
      &[
        payer_info.clone(),
        new_account_info.clone(),
        system_program_info.clone(),
      ],
    )?;
  }

  let accounts = &[new_account_info.clone(), system_program_info.clone()];

  invoke_signed(
    &system_instruction::allocate(new_account_info.key, size.try_into().unwrap()),
    accounts,
    &[&signer_seeds],
  )?;

  invoke_signed(
    &system_instruction::assign(new_account_info.key, &program_id),
    accounts,
    &[&signer_seeds],
  )?;
  Ok(())
}

fn puff_out_data_fields(metadata: &mut Metadata) {
  let mut array_of_zeroes = vec![];
  while array_of_zeroes.len() < MAX_NAME_LENGTH - metadata.data.name.len() {
    array_of_zeroes.push(0u8);
  }
  metadata.data.name = metadata.data.name.clone() + std::str::from_utf8(&array_of_zeroes).unwrap();

  let mut array_of_zeroes = vec![];
  while array_of_zeroes.len() < MAX_SYMBOL_LENGTH - metadata.data.symbol.len() {
    array_of_zeroes.push(0u8);
  }
  metadata.data.symbol =
    metadata.data.symbol.clone() + std::str::from_utf8(&array_of_zeroes).unwrap();

  let mut array_of_zeroes = vec![];
  while array_of_zeroes.len() < MAX_URI_LENGTH - metadata.data.uri.len() {
    array_of_zeroes.push(0u8);
  }
  metadata.data.uri = metadata.data.uri.clone() + std::str::from_utf8(&array_of_zeroes).unwrap();
}

pub struct CreateMetadataAccountsLogicArgs<'a> {
  pub metadata_account_info: &'a AccountInfo<'a>,
  pub mint_info: &'a AccountInfo<'a>,
  pub mint_authority_info: &'a AccountInfo<'a>,
  pub payer_account_info: &'a AccountInfo<'a>,
  pub update_authority_info: &'a AccountInfo<'a>,
  pub system_account_info: &'a AccountInfo<'a>,
  pub rent_info: &'a AccountInfo<'a>,
}

pub fn assert_data_valid(
  data: &Data,
  update_authority: &Pubkey,
  existing_metadata: &Metadata,
  allow_direct_creator_writes: bool,
) -> ProgramResult {
  if data.name.len() > MAX_NAME_LENGTH {
    return Err(MetadataError::NameTooLong.into());
  }

  if data.symbol.len() > MAX_SYMBOL_LENGTH {
    return Err(MetadataError::SymbolTooLong.into());
  }

  if data.uri.len() > MAX_URI_LENGTH {
    return Err(MetadataError::UriTooLong.into());
  }

  if data.seller_fee_basis_points > 10000 {
    return Err(MetadataError::InvalidBasisPoints.into());
  }

  if data.creators.is_some() {
    if let Some(creators) = &data.creators {
      if creators.len() > MAX_CREATOR_LIMIT {
        return Err(MetadataError::CreatorsTooLong.into());
      }

      if creators.is_empty() {
        return Err(MetadataError::CreatorsMustBeAtleastOne.into());
      } else {
        let mut found = false;
        let mut total: u8 = 0;
        for i in 0..creators.len() {
          let creator = &creators[i];
          for j in (i + 1)..creators.len() {
            if creators[j].address == creator.address {
              return Err(MetadataError::DuplicateCreatorAddress.into());
            }
          }

          total = total
            .checked_add(creator.share)
            .ok_or(MetadataError::NumericalOverflowError)?;

          if creator.address == *update_authority {
            found = true;
          }

          // Dont allow metadata owner to unilaterally say a creator verified...
          // cross check with array, only let them say verified=true here if
          // it already was true and in the array.
          // Conversely, dont let a verified creator be wiped.
          if creator.address != *update_authority && !allow_direct_creator_writes {
            if let Some(existing_creators) = &existing_metadata.data.creators {
              match existing_creators
                .iter()
                .find(|c| c.address == creator.address)
              {
                Some(existing_creator) => {
                  if creator.verified && !existing_creator.verified {
                    return Err(MetadataError::CannotVerifyAnotherCreator.into());
                  } else if !creator.verified && existing_creator.verified {
                    return Err(MetadataError::CannotUnverifyAnotherCreator.into());
                  }
                }
                None => {
                  if creator.verified {
                    return Err(MetadataError::CannotVerifyAnotherCreator.into());
                  }
                }
              }
            } else {
              if creator.verified {
                return Err(MetadataError::CannotVerifyAnotherCreator.into());
              }
            }
          }
        }

        if !found && !allow_direct_creator_writes {
          return Err(MetadataError::MustBeOneOfCreators.into());
        }
        if total != 100 {
          return Err(MetadataError::ShareTotalMustBe100.into());
        }
      }
    }
  }

  Ok(())
}

pub fn process_create_metadata_accounts_logic(
  program_id: &Pubkey,
  accounts: CreateMetadataAccountsLogicArgs,
  data: Data,
  allow_direct_creator_writes: bool,
  is_mutable: bool,
) -> ProgramResult {
  let CreateMetadataAccountsLogicArgs {
    metadata_account_info,
    mint_info,
    mint_authority_info,
    payer_account_info,
    update_authority_info,
    system_account_info,
    rent_info,
  } = accounts;

  let mint_authority = get_mint_authority(mint_info)?;
  assert_mint_authority_matches_mint(&mint_authority, mint_authority_info)?;
  assert_owned_by(mint_info, &spl_token::id())?;

  // You'll need a few things to generate the PDA. The first is an array of "seeds," which includes:
  // The Metaplex seed constant: metadata
  // The metadata public key: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
  // The NFT token account mint address
  let metadata_seeds = &[
    PREFIX.as_bytes(),
    program_id.as_ref(),
    mint_info.key.as_ref(),
  ];

  let (metadata_key, metadata_bump_seed) = Pubkey::find_program_address(metadata_seeds, program_id);
  let metadata_authority_signer_seeds = &[
    PREFIX.as_bytes(),
    program_id.as_ref(),
    mint_info.key.as_ref(),
    &[metadata_bump_seed],
  ];

  if metadata_account_info.key != &metadata_key {
    return Err(MetadataError::InvalidMetadataKey.into());
  } else {
    msg!("====={}", &metadata_key);
  }

  create_or_allocate_account_raw(
    *program_id,
    metadata_account_info,
    rent_info,
    system_account_info,
    payer_account_info,
    MAX_METADATA_LEN,
    metadata_authority_signer_seeds,
  )?;

  let mut metadata = Metadata::from_account_info(metadata_account_info)?;

  assert_data_valid(
    &data,
    update_authority_info.key,
    &metadata,
    allow_direct_creator_writes,
  )?;

  metadata.mint = *mint_info.key;
  metadata.key = Key::MetadataV1;
  metadata.data = data;
  metadata.is_mutable = is_mutable;
  metadata.update_authority = *update_authority_info.key;

  puff_out_data_fields(&mut metadata);

  let edition_seeds = &[
    PREFIX.as_bytes(),
    program_id.as_ref(),
    metadata.mint.as_ref(),
    EDITION.as_bytes(),
  ];

  let (_, edition_bump_seed) = Pubkey::find_program_address(edition_seeds, program_id);
  metadata.edition_nonce = Some(edition_bump_seed);

  metadata.serialize(&mut *metadata_account_info.data.borrow_mut())?;
  Ok(())
}
