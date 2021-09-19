import dotenv from 'dotenv';
import { extendBorsh } from './utils/borsh';
import { simulateCreateMetadata } from './simulateCreateMetadata';
import path from 'path';

dotenv.config();
extendBorsh();
const WALLET_PATH = path.resolve(process.env.WALLET_DIR as string, 'id.json');
console.log('Wallet path: ' + WALLET_PATH);

async function main() {
  await simulateCreateMetadata();
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
