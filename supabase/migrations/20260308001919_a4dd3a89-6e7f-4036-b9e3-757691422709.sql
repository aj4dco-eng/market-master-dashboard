
-- Purchase Orders table
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  created_by uuid REFERENCES public.profiles(id),
  status text DEFAULT 'pending',
  order_date date DEFAULT now(),
  expected_date date,
  notes text,
  total_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on purchase_orders" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee select purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employee insert purchase_orders" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employee update purchase_orders" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Accountant select purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'));

-- Purchase Order Items table
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  barcode text,
  product_name text,
  requested_qty numeric NOT NULL DEFAULT 1,
  received_qty numeric DEFAULT 0,
  requested_purchase_price numeric DEFAULT 0,
  actual_purchase_price numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  expiry_date date,
  batch_number text,
  notes text
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on purchase_order_items" ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee select purchase_order_items" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employee insert purchase_order_items" ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Employee update purchase_order_items" ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Accountant select purchase_order_items" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'));

-- Auto-update timestamp
CREATE TRIGGER update_purchase_order_timestamp
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_supplier_timestamp();

-- Sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS purchase_order_seq START 1;

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'PO-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('purchase_order_seq')::text, 4, '0')
$$;
