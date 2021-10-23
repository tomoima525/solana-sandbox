import {
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import path from 'path';
import {
  checkProgram,
  createKeypairFromFile,
  establishConnection,
  getRpcUrl,
} from './utils/connections';
import { mintToken } from './programs/program';
import { createFreezeTokenAccountInstruction } from './programs/freeze';
import { viewAccountInfo, viewTokenAccountInfo } from './utils/info';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const PROGRAM_PATH = path.resolve(__dirname, '../rust/target/deploy');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/solanaprogram.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(
  PROGRAM_PATH,
  'freezeprogram-keypair.json',
);
const WALLET_PATH = path.join(process.env.WALLET_DIR as string, 'id.json');

export async function simulateFreezeAccount(): Promise<void> {
  const instructions: TransactionInstruction[] = [];

  console.log('Start...');
  const url = await getRpcUrl();
  console.log('Success', { url });

  // Check Program is deployed.
  const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
  const connection = await establishConnection();
  await checkProgram(connection, programKeypair.publicKey);

  console.log('Retrieve Wallet');

  const payer = await createKeypairFromFile(WALLET_PATH);

  console.log('payer', payer.publicKey.toBase58());
  console.log('Start minting');

  const walletAccount = await connection.getAccountInfo(payer.publicKey);
  if (walletAccount?.lamports === 0) {
    throw new Error(
      'This wallet does not have enough balance to request transaction',
    );
  }

  // 1. Mint token
  const mint = await mintToken({
    connection,
    payer,
    decimals: 0,
  });
  const mintPublicKey = mint.publicKey.toBase58();
  const mintAuthority =
    (await mint.getMintInfo()).mintAuthority?.toBase58() || '';
  console.log(
    `Minted. key: ${mintPublicKey}\n Authority ${mintAuthority || ''}`,
  );

  const tokenAccount = await mint.getOrCreateAssociatedAccountInfo(
    payer.publicKey,
  );
  console.log(
    `TokenAccount: ${tokenAccount.address.toBase58()} ${tokenAccount.owner.toBase58()}`,
  );
  // 2. freeze token
  instructions.push(
    Token.createFreezeAccountInstruction(
      TOKEN_PROGRAM_ID,
      tokenAccount.address,
      mint.publicKey,
      payer.publicKey,
      [payer],
    ),
  );
  // this instruction does not work;
  // when updateing tokenAccount status, this tokenAccount's owner(programId) should be same as the one who created this token Account, which is TOKEN_PROGRAM_ID
  // This will fail with message "instruction modified data of an account it does not own"(ExternalAccountDataModified)
  // Will leave this and rust program for testing purpose
  // instructions.push(
  //   createFreezeTokenAccountInstruction({
  //     signer: payer.publicKey,
  //     mintToken: mint.publicKey,
  //     targetTokenAccount: tokenAccount.address,
  //     freezeProgramId: programKeypair.publicKey,
  //   }),
  // );

  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));
  await sendAndConfirmTransaction(connection, transaction, [payer], {
    commitment: 'confirmed',
  });

  // 3. check accountinfo
  await viewTokenAccountInfo(connection, tokenAccount.address);
}

simulateFreezeAccount().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
