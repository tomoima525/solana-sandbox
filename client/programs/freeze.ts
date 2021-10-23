import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize } from 'borsh';
import { FreezeAccountArgs, FREEZE_ACCOUNT_SCHEMA } from '../schema/freezedata';

export function createFreezeTokenAccountInstruction({
  signer,
  freezeProgramId,
  mintToken,
  targetTokenAccount,
}: {
  signer: PublicKey;
  freezeProgramId: PublicKey;
  mintToken: PublicKey;
  targetTokenAccount: PublicKey;
}): TransactionInstruction {
  const keys = [
    {
      pubkey: targetTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mintToken,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: signer,
      isSigner: true,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: freezeProgramId,
    data: Buffer.from(
      serialize(FREEZE_ACCOUNT_SCHEMA, new FreezeAccountArgs()),
    ),
  });
}
