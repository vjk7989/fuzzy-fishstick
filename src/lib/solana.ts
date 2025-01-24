import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import { supabase } from './supabase';
import { signAndSendTransaction } from './phantom';

const HOUSE_WALLET = new PublicKey('4BjZSMcDqPoqViHbTkv5UHhTMd21Txb26kJ8AbsCeg2V');
const SOLANA_RPC_URL = clusterApiUrl('devnet');
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const TRANSACTION_TIMEOUT = 30000; // 30 seconds

async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (error.code === 4001) throw error; // Don't retry user rejections
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw lastError;
}

export async function purchaseTokens(amount: number): Promise<boolean> {
  try {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please sign in to continue');
    }

    // Get user's wallet info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('solana_public_key')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.solana_public_key) {
      throw new Error('Please connect your Phantom wallet first');
    }

    const userPublicKey = new PublicKey(profile.solana_public_key);
    const connection = new Connection(SOLANA_RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: TRANSACTION_TIMEOUT
    });

    // Check balance with retry
    const balance = await retry(async () => {
      const bal = await connection.getBalance(userPublicKey);
      if (bal === undefined || bal === null) {
        throw new Error('Failed to get wallet balance');
      }
      return bal;
    });

    const requiredAmount = amount * LAMPORTS_PER_SOL;
    const estimatedFee = 5000; // 5000 lamports fee
    
    if (balance < (requiredAmount + estimatedFee)) {
      throw new Error('Insufficient SOL balance in your wallet');
    }

    // Get latest blockhash with retry
    const { blockhash, lastValidBlockHeight } = await retry(async () => {
      const result = await connection.getLatestBlockhash('finalized');
      if (!result?.blockhash) {
        throw new Error('Failed to get network parameters');
      }
      return result;
    });

    // Create transaction
    const transaction = new Transaction();
    
    // Add transfer instruction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: HOUSE_WALLET,
        lamports: requiredAmount
      })
    );

    // Set transaction parameters
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    // Sign and send transaction with retry
    const signedTransaction = await retry(
      () => signAndSendTransaction(transaction)
    );

    if (!signedTransaction?.signatures.length) {
      throw new Error('Transaction signing failed');
    }

    // Send transaction with retry
    const signature = await retry(async () => {
      const sig = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed'
      });
      if (!sig) {
        throw new Error('Failed to send transaction');
      }
      return sig;
    });

    // Wait for confirmation with timeout
    const confirmationPromise = connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Transaction confirmation timed out')), TRANSACTION_TIMEOUT);
    });

    const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);

    if ('value' in confirmation && confirmation.value.err) {
      throw new Error('Transaction failed');
    }

    // Verify transaction success with retry
    const txInfo = await retry(async () => {
      const info = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      if (!info || info.meta?.err) {
        throw new Error('Transaction verification failed');
      }
      return info;
    });

    if (!txInfo || txInfo.meta?.err) {
      throw new Error('Transaction verification failed');
    }

    return true;
  } catch (error: any) {
    console.error('Error purchasing tokens:', error);
    
    if (error.code === 4001) {
      throw new Error('Transaction was rejected. Please approve the transaction in your Phantom wallet.');
    }
    
    if (error.message?.includes('blockhash')) {
      throw new Error('Network error. Please try again in a few moments.');
    }
    
    if (error.message?.includes('insufficient')) {
      throw new Error('Insufficient SOL balance in your wallet.');
    }
    
    if (error.message?.includes('timeout')) {
      throw new Error('Transaction timed out. Please try again.');
    }
    
    throw new Error(error.message || 'Failed to purchase tokens. Please try again.');
  }
}