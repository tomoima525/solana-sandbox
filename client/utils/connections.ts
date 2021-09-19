/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import os from 'os';
import fs from 'mz/fs';
import path from 'path';
import yaml from 'yaml';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

/**
 * @private
 */
async function getConfig(): Promise<any> {
  // Path to Solana CLI config file
  const CONFIG_FILE_PATH = path.resolve(
    os.homedir(),
    '.config',
    'solana',
    'cli',
    'config.yml',
  );
  const configYml = await fs.readFile(CONFIG_FILE_PATH, { encoding: 'utf8' });
  return yaml.parse(configYml);
}

/**
 * Load and parse the Solana CLI config file to determine which RPC url to use
 */
export async function getRpcUrl(): Promise<string> {
  try {
    const config = await getConfig();
    if (!config.json_rpc_url) throw new Error('Missing RPC URL');
    return config.json_rpc_url;
  } catch (err) {
    console.warn(
      'Failed to read RPC url from CLI config file, falling back to localhost',
    );
    return 'http://localhost:8899';
  }
}

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<Connection> {
  const rpcUrl = await getRpcUrl();
  const connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
  return connection;
}

/**
 * Check if program is deployed and is executable
 */
export async function checkProgram(
  connection: Connection,
  programId: PublicKey,
): Promise<void> {
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    throw new Error(`Program ${programId.toBase58()} is not deployed`);
  }
  if (!programInfo.executable) {
    throw new Error(`Program ${programId.toBase58()} is not executable`);
  }
  console.log(`Program ${programId.toBase58()} is executable`);
}

/**
 * Create a Keypair from a secret key stored in file as bytes' array
 */
export async function createKeypairFromFile(
  filePath: string,
): Promise<Keypair> {
  const secretKeyString = await fs.readFile(filePath, { encoding: 'utf8' });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}
