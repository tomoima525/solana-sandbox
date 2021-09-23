# Solana Sandbox

This sandbox is for verifying smart contracts(programs) implemented on Solana for a self-study purpose.

## Programs

Currently implemented under `rust` directory

### Creating metadata

- The code is mostly referenced from [metaplex](https://github.com/metaplex-foundation/metaplex/tree/master/rust/token-metadata)

### Simulate Escrow

- Idea is from [paulx's blog](https://paulx.dev/blog/2021/01/14/programming-on-solana-an-introduction) but following a real-world usecase
  - Use wallets to manage Accounts
  - Use Associated Token Account to transfer tokens

## Client

### Mint & add metadata on NFT

- Solana has built-in API for minting(`@solana/spl-token`) and transfering transaction(`@solana/web3.js`). This code also showcases how we use them.

## Prerequisite

- rust environment
- node version v14+
- solana tookkit
- solana account that holds decent `SOL` to operate(mint, etc)
  - You can use [airdrop to fund yourself](https://spl.solana.com/token#airdrop-sol)

## How to start

- Install dependencies

```
$ cargo install
$ yarn install
```

- Set up local network for Solana

```
$ solana config set --url localhost // point to local or else it will be deployed to other clusters that you set
```

- Start local validator

```
$ solana-test-validator
```

- Build & deploy program

```
$ cargo build-bpf // compile program
$ solana program deploy /{your directory}/rust/solana-program/dist/program/solanaprogram.so

// You should receive the program id as a result
Program Id: zvM2...
```

The command above will generate `solanaprogram-keypair.json` which will be used in the client code

### Test Escrow

```
$ yarn start:escrow
```

### Test Metadata

```
$ yarn start:metadata
```
