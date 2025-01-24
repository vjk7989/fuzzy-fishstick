/*
  # Add checkpoint system

  1. New Tables
    - `checkpoints`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `balance` (decimal)
      - `game_history` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `checkpoints` table
    - Add policies for authenticated users to manage their own checkpoints
*/

CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  balance decimal NOT NULL DEFAULT 1000.00,
  game_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own checkpoints"
  ON checkpoints
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own checkpoints"
  ON checkpoints
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkpoints"
  ON checkpoints
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_checkpoints_updated_at
  BEFORE UPDATE ON checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();