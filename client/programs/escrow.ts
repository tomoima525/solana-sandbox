/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { serialize } from 'borsh';
import BN from 'bn.js';
import {
  AccountInfo,
  AccountLayout,
  Token,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import type { Signer } from '@solana/web3.js';
import {
  CancelEscrowdataArgs,
  CANCEL_ESCROW_SCHEMA,
  InitEscrowdataArgs,
  Escrowdata,
  INIT_ESCROW_SCHEMA,
  TradeEscrowdataArgs,
  TRADE_ESCROW_SCHEMA,
} from '../schema/escrowdata';
import {
  EscrowLayout,
  ESCROW_ACCOUNT_DATA_LAYOUT,
} from '../utils/escrowLayout';

export async function createAssociatedAccount({
  mintToken,
  owner,
}: {
  mintToken: Token;
  owner: PublicKey;
}): Promise<AccountInfo> {
  return mintToken.getOrCreateAssociatedAccountInfo(owner);
}

async function checkAuthority({
  initializerAccount,
  mintToken,
}: {
  initializerAccount: PublicKey;
  mintToken: Token;
}) {
  const info = await mintToken.getMintInfo();
  const mintAuthority = info?.mintAuthority;
  if (!mintAuthority) {
    throw new Error('Invalid Mint Authority');
  }
  if (!initializerAccount.equals(mintAuthority)) {
    throw new Error('Mint Authority does not match!');
  }
}

export async function createMintTokenAccountFromAToken({
  connection,
  payer,
  mintPublicKey,
  amount,
}: {
  connection: Connection;
  payer: Signer;
  mintPublicKey: PublicKey;
  amount: number;
}): Promise<[PublicKey, Token]> {
  const mintToken = new Token(
    connection,
    mintPublicKey,
    TOKEN_PROGRAM_ID,
    payer,
  );
  const account = await mintToken.getOrCreateAssociatedAccountInfo(
    payer.publicKey,
  );
  console.log('associatedAccount', account.address);
  console.log('payer', payer.publicKey.toBase58());
  await mintToken.mintTo(account.address, payer, [], amount);
  return [account.address, mintToken];
}

export async function createMintTokenReceiverAccountFromAtoken({
  connection,
  mintPublicKey,
  payer,
}: {
  connection: Connection;
  mintPublicKey: PublicKey;
  payer: Signer;
}): Promise<[PublicKey, Token]> {
  const mintToken = new Token(
    connection,
    mintPublicKey,
    TOKEN_PROGRAM_ID,
    payer,
  );
  const account = await mintToken.getOrCreateAssociatedAccountInfo(
    payer.publicKey,
  );
  return [account.address, mintToken];
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

export async function createExchangeInstruction({
  connection,
  escrowAccount,
  pda,
  programId,
  takerAccount,
  takerMintTokenAccount,
  takerReceiveTokenAccount,
  expectedTakerReceiveAmount,
}: {
  connection: Connection;
  escrowAccount: PublicKey;
  pda: PublicKey;
  programId: PublicKey;
  takerAccount: PublicKey;
  takerMintTokenAccount: PublicKey;
  takerReceiveTokenAccount: PublicKey;
  expectedTakerReceiveAmount: number;
}): Promise<TransactionInstruction> {
  const encodedEscrowState = (
    await connection.getAccountInfo(escrowAccount, 'singleGossip')
  )?.data;
  if (!encodedEscrowState) {
    console.log('Invalid EscrowState');
    throw new Error('Invalid Escrow State');
  }
  const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(
    encodedEscrowState,
  ) as EscrowLayout;
  const initializerAccount = new PublicKey(
    decodedEscrowState.initializerPubkey,
  );
  const initializerReceivingTokenAccount = new PublicKey(
    decodedEscrowState.initializerReceivingTokenAccountPubkey,
  );
  const initializerTempToken = new PublicKey(
    decodedEscrowState.initializerTempTokenAccountPubkey,
  );
  const data = new Escrowdata(new BN(expectedTakerReceiveAmount));
  const value = new TradeEscrowdataArgs({ data });
  const txnData = Buffer.from(serialize(TRADE_ESCROW_SCHEMA, value));

  return new TransactionInstruction({
    programId,
    data: txnData,
    keys: [
      {
        pubkey: takerAccount,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: takerMintTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: takerReceiveTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: initializerTempToken,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: initializerAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: initializerReceivingTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: escrowAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: pda, isSigner: false, isWritable: false },
    ],
  });
}

export async function createCancelInstruction({
  connection,
  escrowAccount,
  initializer,
  pda,
  programId,
}: {
  connection: Connection;
  escrowAccount: PublicKey;
  initializer: PublicKey;
  pda: PublicKey;
  programId: PublicKey;
}): Promise<TransactionInstruction> {
  const encodedEscrowState = (
    await connection.getAccountInfo(escrowAccount, 'singleGossip')
  )?.data;
  if (!encodedEscrowState) {
    console.log('Invalid EscrowState');
    throw new Error('Invalid Escrow State');
  }
  const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(
    encodedEscrowState,
  ) as EscrowLayout;

  const initializerAccount = new PublicKey(
    decodedEscrowState.initializerPubkey,
  );
  if (initializer.toBase58() !== initializerAccount.toBase58()) {
    console.log('Initializer mismatch');
    throw new Error('Initializer mismatch');
  }
  const initializerTempToken = new PublicKey(
    decodedEscrowState.initializerTempTokenAccountPubkey,
  );

  return new TransactionInstruction({
    programId,
    data: Buffer.from(
      serialize(CANCEL_ESCROW_SCHEMA, new CancelEscrowdataArgs()),
    ),
    keys: [
      {
        pubkey: initializerAccount,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: initializerTempToken,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: escrowAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: pda, isSigner: false, isWritable: false },
    ],
  });
}
