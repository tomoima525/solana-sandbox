use {
  crate::state::EscrowReceive,
  borsh::{BorshDeserialize, BorshSerialize},
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct InitEscrowArgs {
  pub data: EscrowReceive,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ExchangeArgs {
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
  InitEscrow(InitEscrowArgs),

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
  Exchange(ExchangeArgs),

  /// Cancel escrow
  /// 0. `[signer]` The account cancelling the escrow
  /// 1. `[writable]` The initializer's main account to transfer back the amount sent to temp token account
  /// 2. `[writable]` The PDA's temp token account to close
  /// 3. `[writable]` The escrow account holding the escrow info
  /// 4. `[]` The token program
  /// 5. `[]` The PDA account
  CancelEscrow(),
}
