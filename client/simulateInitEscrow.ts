import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createAccountInstruction,
  createAssociatedAccount,
  createEscrowAccountInstruction,
  createInitEscrowInstruction,
  initAccountInstruction,
} from './programs/escrow';
import { viewAccountInfo, viewEscrowState } from './utils/info';
import { Token } from '@solana/spl-token';

type Result = {
  escrowAccountAddressString: string;
};
export async function simulateInitEscrow({
  connection,
  initializer,
  initializerMint,
  initializerMintTokenAccount,
  programKeypair,
  taker,
  takerMint,
  initializerReceiveAmount,
  initializerSendAmount,
}: {
  connection: Connection;
  initializer: Keypair;
  initializerMint: Token;
  initializerMintTokenAccount: PublicKey;
  programKeypair: Keypair;
  taker: Keypair;
  takerMint: Token;
  initializerSendAmount: number;
  initializerReceiveAmount: number;
}): Promise<Result> {
  const instructions: TransactionInstruction[] = [];

  const associatedAccountForTaker = await createAssociatedAccount({
    mintToken: initializerMint,
    owner: taker.publicKey,
  });
  console.log(
    'Created Associated Token Account for Taker',
    associatedAccountForTaker.address.toBase58(),
  );

  const associatedAccountForReceiving = await createAssociatedAccount({
    mintToken: takerMint,
    owner: initializer.publicKey,
  });

  console.log(
    'Created Associated Token Account for Initializer',
    associatedAccountForReceiving.address.toBase58(),
  );
  console.log('Create temp Account');
  const tempTokenAccount = Keypair.generate();
  instructions.push(
    await createAccountInstruction({
      connection,
      tokenAccount: tempTokenAccount,
      payer: initializer,
    }),
  );

  instructions.push(
    ...initAccountInstruction({
      tempTokenAccountPublicKey: tempTokenAccount.publicKey,
      payer: initializer,
      mint: initializerMint,
      mintTokenAccount: initializerMintTokenAccount,
      amount: initializerSendAmount,
    }),
  );

  console.log('Create escrowToken');
  const escrowAccount = Keypair.generate();
  instructions.push(
    await createEscrowAccountInstruction({
      connection,
      escrowAccount,
      payer: initializer,
      programId: programKeypair.publicKey,
    }),
  );

  console.log('Initialize Escrow');
  instructions.push(
    createInitEscrowInstruction({
      initializer: initializer.publicKey,
      tempTokenAccount: tempTokenAccount.publicKey,
      receiveTokenAccount: associatedAccountForReceiving.address,
      escrowAccount: escrowAccount.publicKey,
      escrowProgramId: programKeypair.publicKey,
      amount: initializerReceiveAmount,
    }),
  );

  // confirm transaction
  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [initializer, tempTokenAccount, escrowAccount],
    {
      commitment: 'confirmed',
    },
  );
  console.log('Transaction confirmed. Signature', signature);
  await viewAccountInfo(
    connection,
    tempTokenAccount.publicKey,
    'tempTokenAccount',
  );
  await viewAccountInfo(connection, escrowAccount.publicKey, 'EscrowAccount');
  await viewEscrowState(connection, escrowAccount.publicKey);
  return {
    escrowAccountAddressString: escrowAccount.publicKey.toBase58(),
  };
}
