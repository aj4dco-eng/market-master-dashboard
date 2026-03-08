
-- Sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE,
  cashier_id uuid REFERENCES public.profiles(id),
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  change_amount numeric DEFAULT 0,
  payment_method text DEFAULT 'cash',
  status text DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Sale items table
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  barcode text,
  unit text,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  discount_percent numeric DEFAULT 0,
  total_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Generate sale number function
CREATE OR REPLACE FUNCTION public.generate_sale_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num int;
  today_str text := to_char(now(), 'YYYYMMDD');
BEGIN
  SELECT coalesce(max(cast(split_part(sale_number, '-', 3) as int)), 0) + 1
  INTO next_num FROM sales WHERE sale_number LIKE 'SAL-' || today_str || '-%';
  RETURN 'SAL-' || today_str || '-' || lpad(next_num::text, 4, '0');
END;
$$;

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_sale_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('completed', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid sale status';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_sale_status_trigger
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.validate_sale_status();

CREATE OR REPLACE FUNCTION public.validate_sale_payment_method()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('cash', 'card', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_sale_payment_method_trigger
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.validate_sale_payment_method();

-- RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_sales" ON public.sales FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_full_sale_items" ON public.sale_items FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Employee can read and insert sales
CREATE POLICY "employee_manage_sales" ON public.sales FOR ALL
  USING (has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'employee'));

CREATE POLICY "employee_manage_sale_items" ON public.sale_items FOR ALL
  USING (has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'employee'));

-- Accountant can read sales
CREATE POLICY "accountant_read_sales" ON public.sales FOR SELECT
  USING (has_role(auth.uid(), 'accountant'));

CREATE POLICY "accountant_read_sale_items" ON public.sale_items FOR SELECT
  USING (has_role(auth.uid(), 'accountant'));
