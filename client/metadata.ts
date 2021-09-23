import dotenv from 'dotenv';
import { extendBorsh } from './utils/borsh';
import { simulateCreateMetadata } from './simulateCreateMetadata';
import path from 'path';
import { simulateInitEscrow } from './simulateInitEscrow';
import { simulateTradeEscrow } from './simulateTradeEscrow';
import {
  establishConnection,
  createNewWalletWithSol,
} from './utils/connections';
import { createMintTokenAccount } from './programs/program';

dotenv.config();
extendBorsh();
const WALLET_PATH = path.resolve(process.env.WALLET_DIR as string, 'id.json');
console.log('Wallet path: ' + WALLET_PATH);

async function main() {
  // await simulateCreateMetadata();
  const connection = await establishConnection();
  // Prepare taker for testing
  const taker = await createNewWalletWithSol(connection, 10);
  const [takerMintTokenAccount, takerMint] = await createMintTokenAccount({
    connection,
    payer: taker,
    amount: 3,
  });
  console.log('Created taker and airdrop some balance');
  console.log('Created taker Mint', takerMint.publicKey.toBase58());

  const initializerSendAmount = 1;
  const initializerReceiveAmount = 3;

  const {
    escrowAccountAddressString,
    initializerAddressString,
    initializerMintAddressString,
  } = await simulateInitEscrow(
    connection,
    taker,
    takerMint,
    initializerSendAmount,
    initializerReceiveAmount,
  );
  await simulateTradeEscrow({
    taker,
    takerMintTokenAccount,
    escrowAccountAddressString,
    initializerAddressString,
    initializerMintAddressString,
    expectedTakerReceiveAmount: initializerSendAmount,
  });
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
