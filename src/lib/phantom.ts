import { PublicKey, Transaction } from '@solana/web3.js';

declare global {
  interface Window {
    phantom?: {
      solana?: {
        connect(): Promise<{ publicKey: PublicKey }>;
        disconnect(): Promise<void>;
        signTransaction(transaction: Transaction): Promise<Transaction>;
        signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
        request(params: any): Promise<any>;
        isConnected: boolean;
        publicKey: PublicKey | null;
      };
    };
  }
}

const PHANTOM_TIMEOUT = 30000; // Reduced to 30 seconds
const CONNECTION_RETRY_DELAY = 1000; // Reduced to 1 second
const MAX_RETRIES = 2; // Reduced to 2 retries

export async function getPhantomProvider() {
  if (!('phantom' in window)) {
    throw new Error('Please install Phantom wallet');
  }

  const provider = window.phantom?.solana;
  if (!provider?.isPhantom) {
    throw new Error('Please install Phantom wallet');
  }

  return provider;
}

export async function connectPhantomWallet(): Promise<string> {
  try {
    const provider = await getPhantomProvider();

    // If already connected with a public key, return it
    if (provider.isConnected && provider.publicKey) {
      return provider.publicKey.toString();
    }

    // Try to disconnect first to ensure clean state
    try {
      await provider.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Ignore disconnect errors
    }

    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      try {
        // Create connection promise with timeout
        const connectionPromise = provider.connect();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection request timed out')), PHANTOM_TIMEOUT);
        });

        const response = await Promise.race([connectionPromise, timeoutPromise]);

        if (!response?.publicKey) {
          throw new Error('No public key received');
        }

        // Wait briefly for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify connection
        if (!provider.isConnected || !provider.publicKey) {
          throw new Error('Connection verification failed');
        }

        return response.publicKey.toString();
      } catch (error: any) {
        attempts++;
        console.error(`Connection attempt ${attempts} failed:`, error);

        if (error.code === 4001) {
          throw new Error('Please approve the connection request in Phantom');
        }

        if (attempts === MAX_RETRIES) {
          throw new Error('Failed to connect to wallet');
        }

        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
      }
    }

    throw new Error('Failed to connect to wallet');
  } catch (error: any) {
    console.error('Wallet connection error:', error);
    
    if (error.code === 4001) {
      throw new Error('Please approve the connection request in Phantom');
    }
    
    if (error.message.includes('timeout')) {
      throw new Error('Connection timed out. Please try again.');
    }
    
    throw new Error(error.message || 'Failed to connect to wallet');
  }
}

export async function signAndSendTransaction(transaction: Transaction): Promise<Transaction> {
  try {
    const provider = await getPhantomProvider();

    // Verify wallet is connected
    if (!provider.isConnected || !provider.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Verify transaction parameters
    if (!transaction.recentBlockhash) {
      throw new Error('Transaction missing blockhash');
    }

    if (!transaction.feePayer) {
      transaction.feePayer = provider.publicKey;
    }

    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      try {
        // Create signing promise with timeout
        const signPromise = provider.signTransaction(transaction);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Transaction signing timed out')), PHANTOM_TIMEOUT);
        });

        const signedTransaction = await Promise.race([signPromise, timeoutPromise]);

        if (!signedTransaction) {
          throw new Error('No signed transaction received');
        }

        // Verify signature
        if (!signedTransaction.signatures.length) {
          throw new Error('Transaction signature verification failed');
        }

        return signedTransaction;
      } catch (error: any) {
        attempts++;
        console.error(`Signing attempt ${attempts} failed:`, error);

        if (error.code === 4001) {
          throw new Error('Please approve the transaction in Phantom');
        }

        if (attempts === MAX_RETRIES) {
          throw new Error('Failed to sign transaction');
        }

        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
      }
    }

    throw new Error('Failed to sign transaction');
  } catch (error: any) {
    console.error('Transaction signing error:', error);
    
    if (error.code === 4001) {
      throw new Error('Please approve the transaction in Phantom');
    }
    
    if (error.message.includes('timeout')) {
      throw new Error('Transaction signing timed out. Please try again.');
    }
    
    if (error.message.includes('blockhash')) {
      throw new Error('Invalid transaction. Please try again.');
    }
    
    throw new Error(error.message || 'Failed to sign transaction');
  }
}