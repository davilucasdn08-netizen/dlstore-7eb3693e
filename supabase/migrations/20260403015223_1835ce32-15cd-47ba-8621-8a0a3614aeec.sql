
CREATE OR REPLACE FUNCTION public.increment_product_clicks(product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products SET clicks = clicks + 1 WHERE id = product_id;
END;
$$;
