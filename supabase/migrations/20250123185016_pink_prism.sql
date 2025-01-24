/*
  # Update token transactions schema

  1. Changes
    - Add game_type column to token_transactions table
    - Update transaction_type check constraint to include game types
    - Add token_balance column to profiles if not exists

  2. Notes
    - Preserves existing data
    - Maintains RLS policies
*/

-- Add token balance to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'token_balance'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN token_balance decimal DEFAULT 0.00;
  END IF;
END $$;

-- Add game_type column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'token_transactions' 
    AND column_name = 'game_type'
  ) THEN
    ALTER TABLE token_transactions
    ADD COLUMN game_type text;
  END IF;
END $$;

-- Update transaction_type check constraint
DO $$ 
BEGIN
  ALTER TABLE token_transactions
    DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;
    
  ALTER TABLE token_transactions
    ADD CONSTRAINT token_transactions_transaction_type_check 
    CHECK (transaction_type IN ('purchase', 'game_spend', 'game_win'));
END $$;