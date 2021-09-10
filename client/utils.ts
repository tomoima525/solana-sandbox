import { PublicKey } from '@solana/web3.js';
import { StringPublicKey } from './metadata';

export async function findProgramAddress(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey,
): Promise<[string, number]> {
  const result = await PublicKey.findProgramAddress(seeds, programId);
  return [result[0].toBase58(), result[1]] as [string, number];
}

export async function getEdition(
  tokenMint: StringPublicKey,
  metadataProgramId: StringPublicKey,
): Promise<StringPublicKey> {
  return (
    await findProgramAddress(
      [
        Buffer.from('metadata'),
        new PublicKey(metadataProgramId).toBuffer(),
        new PublicKey(tokenMint).toBuffer(),
        Buffer.from('edition'),
      ],
      new PublicKey(metadataProgramId),
    )
  )[0];
}
