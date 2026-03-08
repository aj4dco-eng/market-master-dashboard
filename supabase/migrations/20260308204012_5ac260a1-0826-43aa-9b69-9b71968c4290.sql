CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE sql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 'PO-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('purchase_order_seq')::text, 4, '0')
$$;