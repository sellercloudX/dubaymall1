-- Add preparation_days field to products table for seller to set shipping preparation time
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS preparation_days integer DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN public.products.preparation_days IS 'Number of days seller needs to prepare and ship the product after order is placed';