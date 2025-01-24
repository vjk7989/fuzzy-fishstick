import { Keypair, PublicKey } from '@solana/web3.js';
import { encode as encodeBase58 } from 'bs58';
import { supabase } from './supabase';

export async function createSolanaWallet(userId: string) {
  try {
    // Check if wallet already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('solana_public_key')
      .eq('id', userId)
      .single();

    if (existingProfile?.solana_public_key) {
      return { publicKey: existingProfile.solana_public_key };
    }

    // Generate new Solana keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = encodeBase58(keypair.secretKey);

    // Update profile with wallet information
    const { error } = await supabase
      .from('profiles')
      .update({
        solana_public_key: publicKey,
        encrypted_private_key: privateKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    return { publicKey };
  } catch (error: any) {
    console.error('Error creating Solana wallet:', error);
    throw new Error('Failed to create wallet. Please try again.');
  }
}

export async function getWalletInfo(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('solana_public_key, token_balance')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      publicKey: data.solana_public_key,
      balance: Number(data.token_balance || 0)
    };
  } catch (error: any) {
    console.error('Error getting wallet info:', error);
    throw new Error('Failed to get wallet information');
  }
}

export async function verifyWalletOwnership(userId: string, publicKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('solana_public_key')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data.solana_public_key === publicKey;
  } catch (error: any) {
    console.error('Error verifying wallet ownership:', error);
    return false;
  }
}

export async function disconnectWallet(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        solana_public_key: null,
        encrypted_private_key: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error disconnecting wallet:', error);
    throw new Error('Failed to disconnect wallet');
  }
}