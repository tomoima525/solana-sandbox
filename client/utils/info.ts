import { Connection, PublicKey } from '@solana/web3.js';
import { Token } from '@solana/spl-token';
import BN from 'bn.js';
import { EscrowLayout, ESCROW_ACCOUNT_DATA_LAYOUT } from './escrowLayout';

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

export const viewMintInfo = async (token: Token): Promise<void> => {
  const mintInfo = await token.getMintInfo();

  console.log(
    `Mint:${token.publicKey.toBase58()}\n authority:${
      mintInfo.mintAuthority?.toBase58() || ''
    }\n amount:${mintInfo.supply.toString()}\n isInitialized:${
      mintInfo.isInitialized ? 'true' : 'false'
    }`,
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

  console.log(`escrowAccountPubkey: ${escrowAccount.toBase58()}\n
    isInitialized: ${isInitialized}\n 
    initializerAccountPubkey: ${new PublicKey(
      decodedEscrowState.initializerPubkey,
    ).toBase58()}\n 
    XTokenTempAccountPubkey: ${new PublicKey(
      decodedEscrowState.initializerTempTokenAccountPubkey,
    ).toBase58()}\n 
    initializerYTokenAccount: ${new PublicKey(
      decodedEscrowState.initializerReceivingTokenAccountPubkey,
    ).toBase58()}\n 
    expectedAmount: ${new BN(
      decodedEscrowState.expectedAmount,
      10,
      'le',
    ).toNumber()}`);
};
