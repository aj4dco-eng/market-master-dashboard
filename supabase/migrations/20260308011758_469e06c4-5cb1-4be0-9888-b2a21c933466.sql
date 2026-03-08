
-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_type text DEFAULT 'purchase',
  supplier_id uuid REFERENCES public.suppliers(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  status text DEFAULT 'unpaid',
  notes text,
  image_url text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT current_date,
  payment_method text DEFAULT 'cash',
  reference_number text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL UNIQUE,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT current_date,
  payment_method text DEFAULT 'cash',
  receipt_url text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_invoice_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invoice_type IS NOT NULL AND NEW.invoice_type NOT IN ('purchase', 'expense', 'other') THEN
    RAISE EXCEPTION 'Invalid invoice_type';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_invoice_type_trigger BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_type();

CREATE OR REPLACE FUNCTION public.validate_invoice_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('unpaid', 'partial', 'paid', 'overdue') THEN
    RAISE EXCEPTION 'Invalid invoice status';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_invoice_status_trigger BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_status();

CREATE OR REPLACE FUNCTION public.validate_payment_method()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('cash', 'bank_transfer', 'check', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_payment_method_trigger BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_method();

-- Number generation functions
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  next_num int;
  year_str text := to_char(now(), 'YYYY');
BEGIN
  SELECT coalesce(max(cast(split_part(invoice_number, '-', 3) as int)), 0) + 1
  INTO next_num FROM invoices WHERE invoice_number LIKE 'INV-' || year_str || '-%';
  RETURN 'INV-' || year_str || '-' || lpad(next_num::text, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_expense_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  next_num int;
  year_str text := to_char(now(), 'YYYY');
BEGIN
  SELECT coalesce(max(cast(split_part(expense_number, '-', 3) as int)), 0) + 1
  INTO next_num FROM expenses WHERE expense_number LIKE 'EXP-' || year_str || '-%';
  RETURN 'EXP-' || year_str || '-' || lpad(next_num::text, 4, '0');
END; $$;

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_invoices" ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "accountant_full_invoices" ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'accountant'::app_role))
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "employee_read_invoices" ON public.invoices FOR SELECT
  USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "admin_full_payments" ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "accountant_full_payments" ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'accountant'::app_role))
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "admin_full_expenses" ON public.expenses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "accountant_full_expenses" ON public.expenses FOR ALL
  USING (has_role(auth.uid(), 'accountant'::app_role))
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "employee_read_expenses" ON public.expenses FOR SELECT
  USING (has_role(auth.uid(), 'employee'::app_role));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT DO NOTHING;

-- Storage RLS
CREATE POLICY "auth_upload_invoices" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoices');
CREATE POLICY "public_read_invoices" ON storage.objects FOR SELECT USING (bucket_id = 'invoices');
CREATE POLICY "auth_upload_receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "public_read_receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
