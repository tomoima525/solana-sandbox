use {
  crate::{
    instruction::MetadataInstruction,
    logic::{process_create_metadata_accounts_logic, CreateMetadataAccountsLogicArgs},
    state::Data,
  },
  borsh::BorshDeserialize,
  solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
  },
};

pub fn process_instruction<'a>(
  program_id: &'a Pubkey,
  accounts: &'a [AccountInfo<'a>],
  input: &[u8],
) -> ProgramResult {
  let instruction = MetadataInstruction::try_from_slice(input)?;
  match instruction {
    MetadataInstruction::CreateMetadataAccount(args) => {
      msg!("Instruction: Create Metadata Accounts");
      process_create_metadata_account(program_id, accounts, args.data, false, args.is_mutable)
    }
  }
}

pub fn process_create_metadata_account<'a>(
  program_id: &'a Pubkey,
  accounts: &'a [AccountInfo<'a>],
  data: Data,
  allow_direct_creator_writes: bool,
  is_mutable: bool,
) -> ProgramResult {
  let account_info_iter = &mut accounts.iter();
  let metadata_account_info = next_account_info(account_info_iter)?;
  let mint_info = next_account_info(account_info_iter)?;
  let mint_authority_info = next_account_info(account_info_iter)?;
  let payer_account_info = next_account_info(account_info_iter)?;
  let update_authority_info = next_account_info(account_info_iter)?;
  let system_account_info = next_account_info(account_info_iter)?;
  let rent_info = next_account_info(account_info_iter)?;

  process_create_metadata_accounts_logic(
    &program_id,
    CreateMetadataAccountsLogicArgs {
      metadata_account_info,
      mint_authority_info,
      mint_info,
      payer_account_info,
      update_authority_info,
      system_account_info,
      rent_info,
    },
    data,
    allow_direct_creator_writes,
    is_mutable,
  )
}
