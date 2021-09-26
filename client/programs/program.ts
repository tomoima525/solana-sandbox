/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deserializeUnchecked, serialize } from 'borsh';
import { NATIVE_MINT, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import type { Connection as ConnectionType, Signer } from '@solana/web3.js';
import {
  CreateMetadataArgs,
  Data,
  Metadata,
  MetadataKey,
  METADATA_SCHEMA,
} from '../schema/metadata';
import { findProgramAddress } from './programAddress';

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

/**
 * Create MintTokenAccount
 * Token Account that holds amounts to send to
 * owner: payer(initializer)
 * authorizer: payer(initializer)
 */
export async function createMintTokenAccount({
  connection,
  payer,
  amount,
}: {
  connection: Connection;
  payer: Signer;
  amount: number;
}): Promise<[PublicKey, Token]> {
  const mintToken = await Token.createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    0, // Consider it as NFT
    TOKEN_PROGRAM_ID,
  );
  const account = await mintToken.createAccount(payer.publicKey);
  await mintToken.mintTo(account, payer, [], amount);
  return [account, mintToken];
}

/**
 * Create NativeMintTokenAccount
 * Token Account that holds amounts to send to
 * owner: payer(initializer)
 * authorizer: payer(initializer)
 * amount: amount of lamports to wrap
 */
export async function createNativeMintTokenAccount({
  connection,
  payer,
  amount,
}: {
  connection: Connection;
  payer: Signer;
  amount: number;
}): Promise<[PublicKey, Token]> {
  const mintTokenAccount = await Token.createWrappedNativeAccount(
    connection,
    TOKEN_PROGRAM_ID,
    payer.publicKey,
    payer,
    amount,
  );
  const mintToken = new Token(connection, NATIVE_MINT, TOKEN_PROGRAM_ID, payer);
  return [mintTokenAccount, mintToken];
}
// eslint-disable-next-line no-control-regex
const METADATA_REPLACE = new RegExp('\u0000', 'g');
export async function readMetaData({
  connection,
  metadataAccount,
}: {
  connection: ConnectionType;
  metadataAccount: PublicKey;
}): Promise<Metadata> {
  const accountInfo = await connection.getAccountInfo(metadataAccount);
  console.log('====', metadataAccount.toBase58());
  if (!accountInfo) {
    throw new Error('No accountInfo for this public key');
  }
  if (accountInfo.data[0] === MetadataKey.MetadataV1) {
    console.log('This is MetadataV1');
  }

  const metadata = deserializeUnchecked(
    METADATA_SCHEMA,
    Metadata,
    accountInfo.data,
  );
  // remove puffs
  metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, '');
  metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, '');
  metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, '');
  return metadata;
}
