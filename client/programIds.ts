import { PublicKey } from '@solana/web3.js';
import { StringPublicKey } from './metadata';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

// TODO: This should be replaced with own prram that implements Edition functionality
export const METADATA_PROGRAM_ID =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as StringPublicKey;

export const programIds = (): {
  [key: string]: PublicKey | StringPublicKey;
} => {
  return {
    associatedToken: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    token: TOKEN_PROGRAM_ID,
    metadata: METADATA_PROGRAM_ID,
  };
};
