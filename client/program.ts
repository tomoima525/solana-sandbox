import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

import type {
  Connection as ConnectionType,
  PublicKey,
  Signer,
} from '@solana/web3.js';

/**
 * Create Token mint to the payer account
 * @returns
 */
export async function mintToken({
  connection,
  payer,
  decimals,
}: {
  connection: ConnectionType;
  payer: Signer;
  decimals: number;
}): Promise<Token> {
  // We are using existing program
  const mintToken = await Token.createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals,
    TOKEN_PROGRAM_ID,
  );

  const fromTokenAccount = await mintToken.getOrCreateAssociatedAccountInfo(
    payer.publicKey,
  );

  await mintToken.mintTo(fromTokenAccount.address, payer.publicKey, [], 1);

  return mintToken;
}

// export async function createMetaData({
//   programId,
// }: {
//   programId: PublicKey;
// }): Promise<Token> {}
