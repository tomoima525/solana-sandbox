import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import path from 'path';
import {
  createAccountInstruction,
  createEscrowAccountInstruction,
  createInitEscrowInstruction,
  createMintTokenAccount,
  createMintTokenReceiverAccount,
  initAccountInstruction,
} from './programs/program';
import { viewAccountInfo, viewEscrowState, viewMintInfo } from './utils/info';
import {
  checkProgram,
  createKeypairFromFile,
  createNewWalletWithSol,
  establishConnection,
  getRpcUrl,
} from './utils/connections';

const PROGRAM_PATH = path.resolve(__dirname, '../rust/target/deploy');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/solanaprogram.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'escrow-keypair.json');
const WALLET_PATH = path.join(process.env.WALLET_DIR as string, 'id.json');

export async function simulateEscrow(): Promise<void> {
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

  const walletAccount = await connection.getAccountInfo(payer.publicKey);
  if (walletAccount?.lamports === 0) {
    throw new Error(
      'This wallet does not have enough balance to request transaction',
    );
  }

  const amount = 1;
  const taker = await createNewWalletWithSol(connection, 3);

  const takerBalance = await connection.getBalance(taker.publicKey);
  console.log('Created taker and airdrop some balance', takerBalance);

  // Create Mint Token Account that has token to transfer
  console.log('Create Mint Token Account');
  const [mintTokenAccount, mint] = await createMintTokenAccount({
    connection,
    payer,
    amount,
  });

  console.log('Create Receiver MintToken Account');
  const [receiverMintTokenAccount] = await createMintTokenReceiverAccount({
    connection,
    payer,
  });

  console.log('Create temp Account');
  const tempTokenAccount = Keypair.generate();
  instructions.push(
    await createAccountInstruction({
      connection,
      tokenAccount: tempTokenAccount,
      payer,
    }),
  );

  instructions.push(
    ...initAccountInstruction({
      tempTokenAccountPublicKey: tempTokenAccount.publicKey,
      payer,
      mint,
      mintTokenAccount,
      amount,
    }),
  );

  console.log('Create escrowToken');
  const escrowAccount = Keypair.generate();
  instructions.push(
    await createEscrowAccountInstruction({
      connection,
      escrowAccount,
      payer,
      programId: programKeypair.publicKey,
    }),
  );

  console.log('Initialize Escrow');
  instructions.push(
    createInitEscrowInstruction({
      initializer: payer.publicKey,
      tempTokenAccount: tempTokenAccount.publicKey,
      receiveTokenAccount: receiverMintTokenAccount,
      escrowAccount: escrowAccount.publicKey,
      escrowProgramId: programKeypair.publicKey,
      amount,
    }),
  );

  // confirm transaction
  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, tempTokenAccount, escrowAccount],
    {
      commitment: 'confirmed',
    },
  );
  console.log('Transaction confirmed. Signature', signature);
  await viewAccountInfo(
    connection,
    tempTokenAccount.publicKey,
    'tempTokenAccount',
  );
  await viewAccountInfo(connection, mintTokenAccount, 'MintTokenAccount');
  await viewAccountInfo(connection, escrowAccount.publicKey, 'EscrowAccount');
  await viewMintInfo(mint);
  await viewEscrowState(connection, escrowAccount.publicKey);
}
