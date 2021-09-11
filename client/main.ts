import dotenv from 'dotenv';
import { extendBorsh } from './borsh';
import {
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
} from './connections';
import { Data } from './metadata';
import {
  createMetadataAccount,
  createMetadataInstruction,
  mintToken,
  readMetaData,
} from './program';

dotenv.config();
extendBorsh();

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
  const mintAuthority = (await mint.getMintInfo()).mintAuthority?.toBase58();
  console.log(
    `Minted. key: ${mintPublicKey}\n Authority ${mintAuthority || ''}`,
  );

  // 2. Create meta data account
  // 2.1 CreateMetadataAccount
  const metadataAccount = await createMetadataAccount({
    mintKey: mint.publicKey,
    metadataProgramId: programKeypair.publicKey,
  });

  // 2.2 add instruction
  instructions.push(
    createMetadataInstruction({
      data: new Data({
        symbol: 'TEST',
        name: 'TOMO',
        uri: ' '.repeat(64), // blank for now
        sellerFeeBasisPoints: 0,
        creators: null, // null for now
      }),
      metadataAccount,
      metadataProgramId: programKeypair.publicKey,
      mintAuthorityKey: payer.publicKey,
      mintKey: mint.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    }),
  );

  // 3. Send transaction with instructions
  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));

  // 4. confirm transaction
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    {
      commitment: 'confirmed',
    },
  );
  console.log('Transaction confirmed. Signature', signature);

  // View added metadata
  const metaData = await readMetaData({
    connection,
    metadataAccount,
  });
  console.log('Metadata', metaData);
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
