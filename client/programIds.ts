import { PublicKey } from '@solana/web3.js';
import { StringPublicKey } from './metadata';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export const METADATA_PROGRAM_ID =
  'zvM2Tuezszh9dJeHaBC6g1Ptjb3da3fB9DK4gLSd6Vf' as StringPublicKey;
// export const METADATA_PROGRAM_ID =
//   'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as StringPublicKey;

export const programIds = (): {
  [key: string]: PublicKey | StringPublicKey;
} => {
  return {
    associatedToken: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    token: TOKEN_PROGRAM_ID,
    metadata: METADATA_PROGRAM_ID,
  };
};
