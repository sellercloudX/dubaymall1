
-- Add encrypted column
ALTER TABLE public.wildberries_connections 
ADD COLUMN encrypted_api_key text;

-- Encrypt existing plaintext keys using the same encrypt_credentials function
UPDATE public.wildberries_connections 
SET encrypted_api_key = public.encrypt_credentials(
  jsonb_build_object('apiKey', api_key)
)
WHERE api_key IS NOT NULL;

-- Drop the plaintext column
ALTER TABLE public.wildberries_connections DROP COLUMN api_key;
