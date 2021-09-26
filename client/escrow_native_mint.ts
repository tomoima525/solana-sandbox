import dotenv from 'dotenv';
import { extendBorsh } from './utils/borsh';
import path from 'path';
import { simulateInitEscrow } from './simulateInitEscrow';
import { simulateTradeEscrow } from './simulateTradeEscrow';
import {
  checkProgram,
  createKeypairFromFile,
  establishConnection,
  getRpcUrl,
} from './utils/connections';
import {
  createMintTokenAccount,
  createNativeMintTokenAccount,
} from './programs/program';
import { NATIVE_MINT } from '@solana/spl-token';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

dotenv.config();
extendBorsh();
const PROGRAM_PATH = path.resolve(__dirname, '../rust/target/deploy');
/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/solanaprogram.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'escrow-keypair.json');
const BOB_WALLET_PATH = path.resolve(
  process.env.BOB_WALLET_DIR as string,
  'id.json',
);
const ALICE_WALLET_PATH = path.resolve(
  process.env.ALICE_WALLET_DIR as string,
  'id.json',
);
console.log('Alice Wallet path: ' + ALICE_WALLET_PATH);
console.log('Bob Wallet path: ' + BOB_WALLET_PATH);

async function main() {
  console.log('Start...');
  const url = await getRpcUrl();
  console.log('Success', { url });
  const connection = await establishConnection();

  // Check Program is deployed.
  const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);

  await checkProgram(connection, programKeypair.publicKey);

  // Trade 1 Token with 1.5 SOL
  const initializerSendAmount = 1.5 * LAMPORTS_PER_SOL;
  const initializerReceiveAmount = 1;

  console.log('Prepare Initializer');
  const payer = await createKeypairFromFile(ALICE_WALLET_PATH);

  const aliceWalletAccount = await connection.getAccountInfo(payer.publicKey);
  if (aliceWalletAccount?.lamports === 0) {
    throw new Error(
      'Payer wallet does not have enough balance to request transaction',
    );
  }

  // Create Mint Token Account that has token to transfer
  const [mintTokenAccount, nativeMint] = await createNativeMintTokenAccount({
    connection,
    payer,
    amount: initializerSendAmount,
  });
  console.log('Created Initializer Mint', NATIVE_MINT.toBase58());

  // Prepare taker
  console.log('Prepare taker wallet');
  const taker = await createKeypairFromFile(BOB_WALLET_PATH);

  const bobWalletAccount = await connection.getAccountInfo(payer.publicKey);
  if (bobWalletAccount?.lamports === 0) {
    throw new Error(
      'Taker wallet does not have enough balance to request transaction',
    );
  }
  const [takerMintTokenAccount, takerMint] = await createMintTokenAccount({
    connection,
    payer: taker,
    amount: 1,
  });
  // Note: If this taker already has Mint token, then we can use that.
  // $ spl-token accounts -v
  // Token                                         Account                                       Balance
  // ----------------------------------------------------------------------------------------------------------
  // AXUYbQsRDj7kNw7UGqENfFT7shHnGkocUUeCNQkR1qLM  HN1TQz5oFhTwDPqcYV44gvJsNqC6o4PqwxMnL5fpTX7i  2
  //
  // const takerMintTokenAccount = new PublicKey(
  //   'HN1TQz5oFhTwDPqcYV44gvJsNqC6o4PqwxMnL5fpTX7i',
  // );
  // const takerMint = new Token(
  //   connection,
  //   new PublicKey('AXUYbQsRDj7kNw7UGqENfFT7shHnGkocUUeCNQkR1qLM'),
  //   TOKEN_PROGRAM_ID,
  //   taker,
  // );
  console.log('Created taker Mint', takerMint.publicKey.toBase58());

  console.log('\n\n============ starting escrow ===========\n');
  console.log(
    `Initializer: ${payer.publicKey.toBase58()}\n  sends ${initializerSendAmount} lamports through wrapped token`,
  );
  console.log(
    `Taker      : ${taker.publicKey.toBase58()}\n  sends ${initializerReceiveAmount} mint token`,
  );
  const { escrowAccountAddressString } = await simulateInitEscrow({
    connection,
    initializer: payer,
    initializerMint: nativeMint,
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
    initializerMint: nativeMint,
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
