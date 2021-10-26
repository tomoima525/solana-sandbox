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
![](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/5d393a2e-6202-4ebc-abae-efc0b6978c45/Screen_Shot_2021-09-24_at_12.11.02_PM.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAT73L2G45O3KS52Y5%2F20211026%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20211026T232424Z&X-Amz-Expires=86400&X-Amz-Signature=c5c9a2c3f6067e99a5e3ab2de1fe2af363fe97eca15cd799a661f604f9b2c0ad&X-Amz-SignedHeaders=host&response-content-disposition=filename%20%3D%22Screen%2520Shot%25202021-09-24%2520at%252012.11.02%2520PM.png%22)

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

Escrow Native Mint(Wrapped SOL)

```
$ yarn start:escrow-native-mint
```

### Test Metadata

```
$ yarn start:metadata
```
