
-- Categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee can read categories" ON public.categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Accountant can read categories" ON public.categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'));

-- Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  barcode text UNIQUE,
  category_id uuid REFERENCES public.categories(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  unit text DEFAULT 'قطعة',
  purchase_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  current_stock numeric DEFAULT 0,
  min_stock_alert numeric DEFAULT 0,
  image_url text,
  image_thumbnail text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee can select products" ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employee can insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employee can update products" ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Accountant can read products" ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'));

-- Auto-update timestamp trigger
CREATE TRIGGER update_product_timestamp
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_supplier_timestamp();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Admin can delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- Employee can also manage categories (insert for inline add)
CREATE POLICY "Employee can insert categories" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'));
