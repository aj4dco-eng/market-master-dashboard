
-- Make invoices and receipts buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('invoices', 'receipts');

-- Drop public read policies
DROP POLICY IF EXISTS "public_read_invoices" ON storage.objects;
DROP POLICY IF EXISTS "public_read_receipts" ON storage.objects;

-- Add authenticated-only read policies
CREATE POLICY "auth_read_invoices" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoices');
CREATE POLICY "auth_read_receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts');
