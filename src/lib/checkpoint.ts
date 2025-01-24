import { supabase } from './supabase';

export interface Checkpoint {
  id: string;
  user_id: string;
  balance: number;
  game_history: any[];
  created_at: string;
  updated_at: string;
}

export async function saveCheckpoint(balance: number, gameHistory: any[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if checkpoint exists
  const { data: existing } = await supabase
    .from('checkpoints')
    .select()
    .eq('user_id', user.id)
    .single();

  if (existing) {
    // Update existing checkpoint
    const { error } = await supabase
      .from('checkpoints')
      .update({
        balance,
        game_history: gameHistory
      })
      .eq('user_id', user.id);

    if (error) throw error;
  } else {
    // Create new checkpoint
    const { error } = await supabase
      .from('checkpoints')
      .insert({
        user_id: user.id,
        balance,
        game_history: gameHistory
      });

    if (error) throw error;
  }
}

export async function loadCheckpoint(): Promise<Checkpoint | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('checkpoints')
    .select()
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error loading checkpoint:', error);
    return null;
  }

  return data;
}