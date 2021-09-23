import { Token } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createExchangeInstruction,
  createMintTokenReceiverAccountFromAtoken,
} from './programs/escrow';
import { viewAccountInfo } from './utils/info';

export async function simulateTradeEscrow({
  connection,
  programKeypair,
  taker,
  takerMintTokenAccount,
  escrowAccountAddressString,
  initializerMint,
  expectedTakerReceiveAmount,
}: {
  connection: Connection;
  escrowAccountAddressString: string;
  initializerMint: Token;
  programKeypair: Keypair;
  taker: Keypair;
  takerMintTokenAccount: PublicKey;
  expectedTakerReceiveAmount: number;
}): Promise<void> {
  const instructions: TransactionInstruction[] = [];

  const escrowAccount = new PublicKey(escrowAccountAddressString);

  const [receiverMintTokenAccount, receiverMint] =
    await createMintTokenReceiverAccountFromAtoken({
      connection,
      mintPublicKey: initializerMint.publicKey,
      payer: taker,
    });
  console.log(
    'Create Taker Receive MintToken Account',
    receiverMint.publicKey.toBase58(),
  );

  const PDA = await PublicKey.findProgramAddress(
    [Buffer.from('escrow'), programKeypair.publicKey.toBuffer()],
    programKeypair.publicKey,
  );

  console.log('Get Program Derived AccessToken:', PDA[0].toBase58());
  console.log('Exchange Escrow');

  instructions.push(
    await createExchangeInstruction({
      connection,
      escrowAccount,
      pda: PDA[0],
      programId: programKeypair.publicKey,
      takerAccount: taker.publicKey,
      takerMintTokenAccount,
      takerReceiveTokenAccount: receiverMintTokenAccount,
      expectedTakerReceiveAmount,
    }),
  );

  // confirm transaction
  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [taker],
    {
      commitment: 'confirmed',
    },
  );
  console.log('Transaction confirmed. Signature', signature);

  await viewAccountInfo(connection, escrowAccount, 'EscrowAccount');
}
