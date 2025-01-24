import { supabase } from './supabase';
import { purchaseTokens } from './solana';

// Cache token balance in memory with optimistic updates
let cachedBalance: { value: number; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5 seconds

export async function getTokenBalance(): Promise<number> {
  try {
    // Check cache first
    if (cachedBalance && Date.now() - cachedBalance.timestamp < CACHE_DURATION) {
      return cachedBalance.value;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error('Failed to get token balance');
    }

    const balance = Number(data.token_balance || 0);
    
    // Update cache
    cachedBalance = {
      value: balance,
      timestamp: Date.now()
    };

    return balance;
  } catch (error: any) {
    console.error('Error getting token balance:', error);
    throw error;
  }
}

export async function updateTokenBalance(userId: string, newBalance: number): Promise<number> {
  try {
    const roundedBalance = Number(Math.max(0, newBalance).toFixed(2));
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        token_balance: roundedBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('token_balance')
      .single();

    if (error) {
      throw new Error('Failed to update token balance');
    }

    const balance = Number(data.token_balance || 0);
    
    // Update cache
    cachedBalance = {
      value: balance,
      timestamp: Date.now()
    };

    return balance;
  } catch (error: any) {
    console.error('Error updating token balance:', error);
    throw error;
  }
}

export async function recordGameTransaction(
  userId: string,
  gameType: 'crash' | 'dice' | 'plinko' | 'blackjack',
  amount: number,
  isWin: boolean
): Promise<void> {
  try {
    // Get current balance first
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error('Failed to get current balance');
    }

    const currentBalance = Number(profile?.token_balance || 0);

    // For spending, verify sufficient balance
    if (!isWin && amount > currentBalance) {
      throw new Error('Insufficient token balance');
    }

    // Record transaction first
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        transaction_type: isWin ? 'game_win' : 'game_spend',
        token_amount: Number(amount.toFixed(2)),
        game_type: gameType,
        created_at: new Date().toISOString()
      });

    if (transactionError) {
      throw new Error('Failed to record game transaction');
    }

    // Update balance
    const newBalance = isWin 
      ? currentBalance + amount 
      : currentBalance - amount;

    await updateTokenBalance(userId, newBalance);

    // Update cache
    cachedBalance = {
      value: newBalance,
      timestamp: Date.now()
    };
  } catch (error: any) {
    console.error('Error recording game transaction:', error);
    throw new Error(error.message || 'Failed to process game transaction');
  }
}

export async function buyTokens(solAmount: number): Promise<{ success: boolean; tokenAmount: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please sign in to continue');
    }

    // Validate amount
    if (solAmount <= 0) {
      throw new Error('Please enter a valid amount');
    }

    // Convert SOL to tokens (1 SOL = 10 tokens)
    const tokenAmount = solAmount * 10;

    // Get current balance before transaction
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Failed to get current balance');
    }

    const currentBalance = Number(profile?.token_balance || 0);

    try {
      // Process Solana transaction first
      const success = await purchaseTokens(solAmount);
      if (!success) {
        throw new Error('Transaction failed. Please try again.');
      }

      // Record the purchase transaction
      const { error: transactionError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'purchase',
          sol_amount: solAmount,
          token_amount: tokenAmount,
          created_at: new Date().toISOString()
        });

      if (transactionError) {
        throw new Error('Failed to record transaction');
      }

      // Update user's token balance
      const newBalance = currentBalance + tokenAmount;
      await updateTokenBalance(user.id, newBalance);

      // Update cache
      cachedBalance = {
        value: newBalance,
        timestamp: Date.now()
      };

      return { success: true, tokenAmount };
    } catch (error: any) {
      // If the error is from the wallet, rethrow it
      if (error.code === 4001) {
        throw error;
      }

      // For other errors, try to restore the balance
      try {
        await updateTokenBalance(user.id, currentBalance);
      } catch (restoreError) {
        console.error('Failed to restore balance:', restoreError);
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Error buying tokens:', error);
    if (error.code === 4001) {
      throw new Error('Transaction was rejected. Please approve the transaction in your Phantom wallet.');
    }
    throw new Error(error.message || 'Failed to purchase tokens. Please try again.');
  }
}