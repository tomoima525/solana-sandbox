import { Connection, PublicKey } from '@solana/web3.js';
import { Token } from '@solana/spl-token';
import BN from 'bn.js';
import { EscrowLayout, ESCROW_ACCOUNT_DATA_LAYOUT } from './escrowLayout';
import { create } from 'superstruct';
import { TokenAccount } from '../model/token';

export const viewAccountInfo = async (
  connection: Connection,
  account: PublicKey,
  name: string,
): Promise<void> => {
  const info = await connection.getAccountInfo(account);

  console.log(
    `Account ${name}\n lamports:${info?.lamports || 0}\n owner: ${
      info?.owner?.toBase58() || ''
    }`,
  );
};

export const viewTokenAccountInfo = async (
  connection: Connection,
  account: PublicKey,
): Promise<void> => {
  const info = await connection.getParsedAccountInfo(account);
  const tokenAccount = create(info.value?.data, TokenAccount);

  console.log(
    `TokenAccount ${account.toBase58()} 
      owner: ${tokenAccount.parsed.info.owner.toBase58()}
      tokenAmount: ${tokenAccount.parsed.info.tokenAmount.uiAmountString}
      state: ${tokenAccount.parsed.info.state}
      `,
  );
};

export const viewMintInfo = async ({
  token,
  account,
}: {
  token: Token;
  account: PublicKey;
}): Promise<void> => {
  const mintInfo = await token.getAccountInfo(account);
  console.log(
    `Mint:${token.publicKey.toBase58()}
      owner:${mintInfo.owner.toBase58()} 
      amount:${mintInfo.amount.toNumber()}`,
  );
};

export const viewEscrowState = async (
  connection: Connection,
  escrowAccount: PublicKey,
): Promise<void> => {
  const encodedEscrowState = (
    await connection.getAccountInfo(escrowAccount, 'singleGossip')
  )?.data;
  if (!encodedEscrowState) {
    console.log('Invalid EscrowState');
    return;
  }
  const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(
    encodedEscrowState,
  ) as EscrowLayout;
  const isInitialized = decodedEscrowState.isInitialized ? 'true' : 'false';

  console.log(`escrowAccountPubkey: ${escrowAccount.toBase58()}
    isInitialized: ${isInitialized}
    initializerAccountPubkey: ${new PublicKey(
      decodedEscrowState.initializerPubkey,
    ).toBase58()}
    XTokenTempAccountPubkey: ${new PublicKey(
      decodedEscrowState.initializerTempTokenAccountPubkey,
    ).toBase58()} 
    initializerYTokenAccount: ${new PublicKey(
      decodedEscrowState.initializerReceivingTokenAccountPubkey,
    ).toBase58()} 
    expectedAmount: ${new BN(
      decodedEscrowState.expectedAmount,
      10,
      'le',
    ).toNumber()}`);
};
