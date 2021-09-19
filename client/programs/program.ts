import { deserializeUnchecked, serialize } from 'borsh';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
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
