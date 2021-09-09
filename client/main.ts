import dotenv from 'dotenv';
import {
  checkProgram,
  createKeypairFromFile,
  establishConnection,
  getRpcUrl,
} from './connections';
import { mintToken } from './program';

import path from 'path';

dotenv.config();

const PROGRAM_PATH = path.resolve(__dirname, '../dist/program');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/solanaprogram.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(
  PROGRAM_PATH,
  'solanaprogram-keypair.json',
);

const WALLET_PATH = path.resolve(process.env.WALLET_DIR as string, 'id.json');

async function main() {
  console.log('Start...');
  const url = await getRpcUrl();
  console.log('Success', { url });
  const keypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
  const connection = await establishConnection();
  await checkProgram(connection, keypair.publicKey);

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

  const mint = await mintToken({
    connection,
    payer,
    decimals: 9,
  });
  console.log('Mint:', await mint.getMintInfo());
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
