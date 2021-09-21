/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { deserializeUnchecked, serialize } from 'borsh';
import BN from 'bn.js';
import { AccountLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  Keypair,
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
import {
  InitEscrowdataArgs,
  Escrowdata,
  INIT_ESCROW_SCHEMA,
} from '../schema/escrowdata';
import { findProgramAddress } from './programAddress';
import { ESCROW_ACCOUNT_DATA_LAYOUT } from '../utils/escrowLayout';

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
    payer.publicKey,
    0, // Consider it as NFT
    TOKEN_PROGRAM_ID,
  );
  const account = await mintToken.createAccount(payer.publicKey);
  await mintToken.mintTo(account, payer, [], amount);
  return [account, mintToken];
}

/**
 * Receiver MintTokenAccount. Nothing is minted
 * @returns
 */
export async function createMintTokenReceiverAccount({
  connection,
  payer,
}: {
  connection: Connection;
  payer: Signer;
}): Promise<[PublicKey, Token]> {
  const mintToken = await Token.createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    0, // Consider it as NFT
    TOKEN_PROGRAM_ID,
  );
  const account = await mintToken.createAccount(payer.publicKey);
  return [account, mintToken];
}

/**
 * Initialize TokenAccount before Escrow
 * 1. Initialize temp TokenAccount as MintTokenAccount
 *   -> owner: Payer(initializer)
 * 2. Transfer tokens to TempAccount from MintToken Account
 */
export function initAccountInstruction({
  tempTokenAccountPublicKey,
  mint,
  mintTokenAccount,
  payer,
  amount,
}: {
  tempTokenAccountPublicKey: PublicKey;
  mint: Token;
  mintTokenAccount: PublicKey;
  payer: Signer;
  amount: number;
}): TransactionInstruction[] {
  const initTempAccountInstruction = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    mint.publicKey,
    tempTokenAccountPublicKey,
    payer.publicKey,
  );
  const transferTokensToTempAccInstruction = Token.createTransferInstruction(
    TOKEN_PROGRAM_ID,
    mintTokenAccount,
    tempTokenAccountPublicKey,
    payer.publicKey,
    [],
    amount,
  );

  return [initTempAccountInstruction, transferTokensToTempAccInstruction];
}

export async function createAccountInstruction({
  connection,
  tokenAccount,
  payer,
}: {
  connection: Connection;
  tokenAccount: Keypair;
  payer: Signer;
}): Promise<TransactionInstruction> {
  // https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js#L356
  return SystemProgram.createAccount({
    programId: TOKEN_PROGRAM_ID,
    space: AccountLayout.span,
    lamports: await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span,
      'singleGossip',
    ),
    fromPubkey: payer.publicKey,
    newAccountPubkey: tokenAccount.publicKey,
  });
}

export async function createEscrowAccountInstruction({
  connection,
  escrowAccount,
  payer,
  programId,
}: {
  connection: Connection;
  escrowAccount: Keypair;
  payer: Signer;
  programId: PublicKey;
}): Promise<TransactionInstruction> {
  return SystemProgram.createAccount({
    programId,
    space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
    lamports: await connection.getMinimumBalanceForRentExemption(
      ESCROW_ACCOUNT_DATA_LAYOUT.span,
      'singleGossip',
    ),
    fromPubkey: payer.publicKey,
    newAccountPubkey: escrowAccount.publicKey,
  });
}
export function createInitEscrowInstruction({
  initializer,
  tempTokenAccount,
  receiveTokenAccount,
  escrowAccount,
  escrowProgramId,
  amount,
}: {
  initializer: PublicKey;
  tempTokenAccount: PublicKey;
  receiveTokenAccount: PublicKey;
  escrowAccount: PublicKey;
  escrowProgramId: PublicKey;
  amount: number;
}): TransactionInstruction {
  const data = new Escrowdata(new BN(amount));
  const value = new InitEscrowdataArgs({ data });
  const txnData = Buffer.from(serialize(INIT_ESCROW_SCHEMA, value));
  const keys = [
    {
      pubkey: initializer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: tempTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: receiveTokenAccount,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: escrowAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: escrowProgramId,
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
