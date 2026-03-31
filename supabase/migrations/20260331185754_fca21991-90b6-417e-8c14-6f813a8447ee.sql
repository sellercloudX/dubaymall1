UPDATE marketplace_connections 
SET credentials = jsonb_build_object(
  'apiKey', 'CnJxlSNfyJdAy0e/H8UXeG7z6EDTl2fXLOOz6fckXOM=',
  'shopId', 40852,
  'campaignId', 40852
),
updated_at = now()
WHERE id = 'be310674-a3b7-4e47-941d-3983c7462fc4';