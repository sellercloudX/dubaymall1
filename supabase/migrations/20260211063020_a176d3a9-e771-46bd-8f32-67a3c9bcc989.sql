
-- Create encrypt/decrypt helper functions using pgcrypto
-- The encryption key is stored as a Supabase secret (CREDENTIALS_ENCRYPTION_KEY)

CREATE OR REPLACE FUNCTION public.encrypt_credentials(p_credentials jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.settings.credentials_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    -- Fallback: return base64-encoded JSON if no key configured
    RETURN encode(convert_to(p_credentials::text, 'UTF8'), 'base64');
  END IF;
  RETURN encode(
    pgp_sym_encrypt(p_credentials::text, v_key),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_credentials(p_encrypted text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_decrypted text;
BEGIN
  v_key := current_setting('app.settings.credentials_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    -- Fallback: try base64 decode
    RETURN convert_from(decode(p_encrypted, 'base64'), 'UTF8')::jsonb;
  END IF;
  v_decrypted := pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    v_key
  );
  RETURN v_decrypted::jsonb;
EXCEPTION WHEN OTHERS THEN
  -- If decryption fails (e.g. data is plain JSON), try parsing directly
  BEGIN
    RETURN p_encrypted::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

-- Add encrypted_credentials column
ALTER TABLE public.marketplace_connections 
ADD COLUMN IF NOT EXISTS encrypted_credentials text;

-- Revoke direct access to encrypt/decrypt from anon (only service role should use)
REVOKE EXECUTE ON FUNCTION public.encrypt_credentials(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_credentials(text) FROM anon;
