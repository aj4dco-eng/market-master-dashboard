
-- Create inventory_sessions table
CREATE TABLE IF NOT EXISTS public.inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name text NOT NULL,
  status text DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  total_system_value numeric DEFAULT 0,
  total_actual_value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  barcode text,
  unit text,
  system_qty numeric DEFAULT 0,
  actual_qty numeric,
  purchase_price numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_inventory_session_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('draft', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Status must be draft, in_progress, or completed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_inventory_session_status_trigger
  BEFORE INSERT OR UPDATE ON public.inventory_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_session_status();

-- Enable RLS
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_sessions
CREATE POLICY "authenticated_read_sessions" ON public.inventory_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_accountant_manage_sessions" ON public.inventory_sessions
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
  );

-- RLS policies for inventory_items
CREATE POLICY "authenticated_read_items" ON public.inventory_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "all_roles_manage_inventory_items" ON public.inventory_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
