import { serialize } from 'borsh';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import type { Connection as ConnectionType, Signer } from '@solana/web3.js';
import { SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID } from './programIds';
import { CreateMetadataArgs, Data, METADATA_SCHEMA } from './metadata';
import { findProgramAddress } from './utils';

/**
 * Create Token mint to the payer account
 * @returns
 */
export async function mintToken({
  connection,
  payer,
  decimals,
}: {
  connection: ConnectionType;
  payer: Signer;
  decimals: number;
}): Promise<Token> {
  // We are using existing program
  const mintToken = await Token.createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals,
    TOKEN_PROGRAM_ID,
  );

  const fromTokenAccount = await mintToken.getOrCreateAssociatedAccountInfo(
    payer.publicKey,
  );

  // Mint 1 Token
  await mintToken.mintTo(fromTokenAccount.address, payer.publicKey, [], 1);

  return mintToken;
}

export async function createMetadataAccount({
  mintKey,
  metadataProgramId,
}: {
  mintKey: PublicKey;
  metadataProgramId: PublicKey;
}): Promise<PublicKey> {
  const metadataAccount = (
    await findProgramAddress(
      [
        Buffer.from('metadata'),
        metadataProgramId.toBuffer(),
        mintKey.toBuffer(),
      ],
      metadataProgramId,
    )
  )[0];
  return new PublicKey(metadataAccount);
}

export function createMetadataInstruction({
  data,
  metadataAccount,
  updateAuthority,
  mintKey,
  mintAuthorityKey,
  payer,
  metadataProgramId,
}: {
  data: Data;
  metadataAccount: PublicKey;
  updateAuthority: PublicKey;
  mintKey: PublicKey;
  mintAuthorityKey: PublicKey;
  payer: PublicKey;
  metadataProgramId: PublicKey;
}): TransactionInstruction {
  console.log('Data', data);
  const value = new CreateMetadataArgs({ data, isMutable: true });
  const txnData = Buffer.from(serialize(METADATA_SCHEMA, value));

  const keys = [
    {
      pubkey: metadataAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mintKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: mintAuthorityKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: updateAuthority,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: metadataProgramId,
    data: txnData,
  });
}

// TODO: remove. Not used
export function createAssociatedTokenAccountInstruction({
  associatedTokenAddress,
  payer,
  walletAddress,
  splTokenMintAddress,
}: {
  associatedTokenAddress: PublicKey;
  payer: PublicKey;
  walletAddress: PublicKey;
  splTokenMintAddress: PublicKey;
}): TransactionInstruction {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

// export async function createMetaData({
//   programId,
// }: {
//   programId: PublicKey;
// }): Promise<Token> {}
