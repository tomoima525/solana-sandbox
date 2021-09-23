import dotenv from 'dotenv';
import { extendBorsh } from './utils/borsh';
import path from 'path';
import { simulateInitEscrow } from './simulateInitEscrow';
import { simulateTradeEscrow } from './simulateTradeEscrow';
import {
  checkProgram,
  createKeypairFromFile,
  createNewWalletWithSol,
  establishConnection,
  getRpcUrl,
} from './utils/connections';
import { createMintTokenAccount } from './programs/program';

dotenv.config();
extendBorsh();
const PROGRAM_PATH = path.resolve(__dirname, '../rust/target/deploy');
/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/solanaprogram.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'escrow-keypair.json');
const WALLET_PATH = path.resolve(process.env.WALLET_DIR as string, 'id.json');
console.log('Wallet path: ' + WALLET_PATH);

async function main() {
  console.log('Start...');
  const url = await getRpcUrl();
  console.log('Success', { url });
  const connection = await establishConnection();

  // Check Program is deployed.
  const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);

  await checkProgram(connection, programKeypair.publicKey);

  const initializerSendAmount = 1;
  const initializerReceiveAmount = 3;

  console.log('Prepare Initializer');
  const payer = await createKeypairFromFile(WALLET_PATH);

  const walletAccount = await connection.getAccountInfo(payer.publicKey);
  if (walletAccount?.lamports === 0) {
    throw new Error(
      'This wallet does not have enough balance to request transaction',
    );
  }

  // Create Mint Token Account that has token to transfer
  const [mintTokenAccount, mint] = await createMintTokenAccount({
    connection,
    payer,
    amount: initializerSendAmount,
  });
  console.log('Created Initializer Mint', mint.publicKey.toBase58());

  // Prepare taker
  console.log('Prepare taker and airdrop some balance');
  const taker = await createNewWalletWithSol(connection, 10);
  const [takerMintTokenAccount, takerMint] = await createMintTokenAccount({
    connection,
    payer: taker,
    amount: 3,
  });
  console.log('Created taker Mint', takerMint.publicKey.toBase58());

  console.log('\n\n============ starting escrow ===========\n');
  console.log(
    `Initializer: ${payer.publicKey.toBase58()}\n  sends ${initializerSendAmount} mint token`,
  );
  console.log(
    `Taker      : ${taker.publicKey.toBase58()}\n  sends ${initializerReceiveAmount} mint token`,
  );
  const { escrowAccountAddressString } = await simulateInitEscrow({
    connection,
    initializer: payer,
    initializerMint: mint,
    initializerMintTokenAccount: mintTokenAccount,
    programKeypair,
    taker,
    takerMint,
    initializerSendAmount,
    initializerReceiveAmount,
  });

  await simulateTradeEscrow({
    connection,
    escrowAccountAddressString,
    expectedTakerReceiveAmount: initializerSendAmount,
    initializerMint: mint,
    programKeypair,
    taker,
    takerMintTokenAccount,
  });
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
