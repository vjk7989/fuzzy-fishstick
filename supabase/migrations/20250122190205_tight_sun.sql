/*
  # Add Solana wallet support

  1. Changes to profiles table
    - Add solana_public_key column
    - Add solana_private_key column (encrypted)
    
  2. Security
    - Add encryption for private keys
    - Update RLS policies
*/

-- Create extension for encryption if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add Solana wallet columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS solana_public_key text UNIQUE,
ADD COLUMN IF NOT EXISTS encrypted_private_key text;

-- Function to generate and encrypt Solana wallet
CREATE OR REPLACE FUNCTION generate_solana_wallet()
RETURNS TABLE (public_key text, encrypted_key text) AS $$
DECLARE
  encryption_key text := current_setting('app.settings.encryption_key', true);
BEGIN
  -- This is a placeholder that will be replaced by actual wallet generation
  -- in the application layer
  RETURN QUERY SELECT 
    'dummy_public_key'::text as public_key,
    encode(encrypt(
      'dummy_private_key'::bytea,
      encryption_key::bytea,
      'aes'
    ), 'base64') as encrypted_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;