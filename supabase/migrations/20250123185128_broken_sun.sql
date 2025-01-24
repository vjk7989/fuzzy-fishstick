/*
  # Update token handling for games

  1. Changes
    - Add game_type validation
    - Add token transaction triggers
    - Add balance update functions

  2. Notes
    - Ensures consistent token handling across games
    - Adds automatic balance updates
    - Maintains transaction history
*/

-- Add game type validation
ALTER TABLE token_transactions
ADD CONSTRAINT valid_game_type_check
CHECK (
  game_type IN ('crash', 'dice', 'plinko', 'blackjack') 
  OR game_type IS NULL
);

-- Create function to validate token balance
CREATE OR REPLACE FUNCTION check_token_balance()
RETURNS trigger AS $$
BEGIN
  IF NEW.transaction_type = 'game_spend' THEN
    -- Check if user has enough tokens
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = NEW.user_id 
      AND token_balance >= NEW.token_amount
    ) THEN
      RAISE EXCEPTION 'Insufficient token balance';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for token balance validation
CREATE TRIGGER validate_token_balance
  BEFORE INSERT ON token_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_token_balance();

-- Create function to update user balance
CREATE OR REPLACE FUNCTION update_user_token_balance()
RETURNS trigger AS $$
BEGIN
  IF NEW.transaction_type = 'game_spend' THEN
    UPDATE profiles 
    SET token_balance = token_balance - NEW.token_amount,
        updated_at = now()
    WHERE id = NEW.user_id;
  ELSIF NEW.transaction_type IN ('game_win', 'purchase') THEN
    UPDATE profiles 
    SET token_balance = token_balance + NEW.token_amount,
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for balance updates
CREATE TRIGGER update_balance_after_transaction
  AFTER INSERT ON token_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_token_balance();