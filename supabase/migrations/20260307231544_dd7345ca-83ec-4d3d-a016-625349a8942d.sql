CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  tax_number text,
  commercial_register text,
  address text,
  city text,
  country text DEFAULT 'Israel',
  phone text,
  email text,
  website text,
  payment_terms text,
  credit_limit numeric DEFAULT 0,
  credit_days integer DEFAULT 0,
  contact1_name text,
  contact1_title text,
  contact1_phone text,
  contact1_whatsapp text,
  contact1_email text,
  contact2_name text,
  contact2_title text,
  contact2_phone text,
  contact2_whatsapp text,
  contact2_email text,
  single_order_limit numeric DEFAULT 0,
  monthly_limit numeric DEFAULT 0,
  rating integer,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Rating validation trigger
CREATE OR REPLACE FUNCTION public.validate_supplier_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5) THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_supplier_rating
  BEFORE INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.validate_supplier_rating();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_supplier_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_supplier_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_supplier_timestamp();

-- RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do all on suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Employees can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));