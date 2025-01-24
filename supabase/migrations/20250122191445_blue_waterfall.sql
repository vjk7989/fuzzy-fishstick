/*
  # Add token system

  1. New Tables
    - `token_transactions`
      - Records all token purchases and usage
      - Tracks SOL to token conversions
      - Maintains transaction history

  2. Changes
    - Add token_balance to profiles table
    - Add transaction tracking functions

  3. Security
    - Enable RLS on new table
    - Add policies for user access
*/

-- Add token balance to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS token_balance decimal DEFAULT 0.00;

-- Create token transactions table
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'game_spend', 'game_win')),
  sol_amount decimal,
  token_amount decimal NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for token_transactions
CREATE POLICY "Users can view own transactions"
  ON token_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON token_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to record token purchase
CREATE OR REPLACE FUNCTION record_token_purchase(
  user_id uuid,
  sol_amount decimal,
  token_amount decimal
) RETURNS void AS $$
BEGIN
  -- Insert transaction record
  INSERT INTO token_transactions (
    user_id,
    transaction_type,
    sol_amount,
    token_amount
  ) VALUES (
    user_id,
    'purchase',
    sol_amount,
    token_amount
  );

  -- Update user's token balance
  UPDATE profiles
  SET token_balance = token_balance + token_amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;