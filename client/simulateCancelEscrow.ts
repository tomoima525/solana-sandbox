import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { createCancelInstruction } from './programs/escrow';
import { viewAccountInfo } from './utils/info';

export async function simulateCancelEscrow({
  connection,
  programKeypair,
  escrowAccountAddressString,
  initializer,
}: {
  connection: Connection;
  escrowAccountAddressString: string;
  programKeypair: Keypair;
  initializer: Keypair;
}): Promise<void> {
  const instructions: TransactionInstruction[] = [];

  const escrowAccount = new PublicKey(escrowAccountAddressString);

  const PDA = await PublicKey.findProgramAddress(
    [Buffer.from('escrow'), programKeypair.publicKey.toBuffer()],
    programKeypair.publicKey,
  );

  console.log('Get Program Derived AccessToken:', PDA[0].toBase58());
  console.log('Cancel Escrow');

  instructions.push(
    await createCancelInstruction({
      connection,
      escrowAccount,
      initializer: initializer.publicKey,
      pda: PDA[0],
      programId: programKeypair.publicKey,
    }),
  );

  // confirm transaction
  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [initializer],
    {
      commitment: 'confirmed',
    },
  );
  console.log('Transaction confirmed. Signature', signature);

  await viewAccountInfo(connection, escrowAccount, 'EscrowAccount');
}
