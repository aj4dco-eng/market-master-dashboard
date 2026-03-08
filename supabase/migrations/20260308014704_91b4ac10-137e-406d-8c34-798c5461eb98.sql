
-- Role default permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE(role, module, action)
);

-- User-specific permission overrides
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, module, action)
);

-- RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- All authenticated can read permissions (needed for permission checks)
CREATE POLICY "authenticated_read_role_permissions" ON public.role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_role_permissions" ON public.role_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "authenticated_read_user_overrides" ON public.user_permission_overrides
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_user_overrides" ON public.user_permission_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Security definer function to check permissions
CREATE OR REPLACE FUNCTION public.check_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _override boolean;
  _role_allowed boolean;
  _user_role app_role;
BEGIN
  -- Check user override first
  SELECT allowed INTO _override
  FROM user_permission_overrides
  WHERE user_id = _user_id AND module = _module AND action = _action;
  
  IF _override IS NOT NULL THEN
    RETURN _override;
  END IF;
  
  -- Fall back to role default
  SELECT role INTO _user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF _user_role IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT allowed INTO _role_allowed
  FROM role_permissions
  WHERE role = _user_role AND module = _module AND action = _action;
  
  RETURN COALESCE(_role_allowed, false);
END;
$$;

-- Seed default permissions for admin (full access)
INSERT INTO role_permissions (role, module, action, allowed) VALUES
  ('admin', 'suppliers', 'view', true), ('admin', 'suppliers', 'create', true), ('admin', 'suppliers', 'edit', true), ('admin', 'suppliers', 'delete', true),
  ('admin', 'products', 'view', true), ('admin', 'products', 'create', true), ('admin', 'products', 'edit', true), ('admin', 'products', 'delete', true), ('admin', 'products', 'edit_prices', true),
  ('admin', 'orders', 'view', true), ('admin', 'orders', 'create', true), ('admin', 'orders', 'edit', true), ('admin', 'orders', 'delete', true),
  ('admin', 'inventory', 'view', true), ('admin', 'inventory', 'create', true), ('admin', 'inventory', 'edit', true),
  ('admin', 'sales', 'view', true), ('admin', 'sales', 'cancel', true),
  ('admin', 'pos', 'view', true), ('admin', 'pos', 'use', true),
  ('admin', 'invoices', 'view', true), ('admin', 'invoices', 'create', true), ('admin', 'invoices', 'edit', true), ('admin', 'invoices', 'delete', true),
  ('admin', 'expenses', 'view', true), ('admin', 'expenses', 'create', true), ('admin', 'expenses', 'edit', true), ('admin', 'expenses', 'delete', true),
  ('admin', 'reports', 'view', true), ('admin', 'reports', 'export', true),
  ('admin', 'users', 'view', true), ('admin', 'users', 'create', true), ('admin', 'users', 'edit', true), ('admin', 'users', 'delete', true),
  ('admin', 'settings', 'view', true), ('admin', 'settings', 'edit', true),
  ('admin', 'permissions', 'view', true), ('admin', 'permissions', 'edit', true),

  -- Accountant defaults
  ('accountant', 'suppliers', 'view', true), ('accountant', 'suppliers', 'create', false), ('accountant', 'suppliers', 'edit', false), ('accountant', 'suppliers', 'delete', false),
  ('accountant', 'products', 'view', true), ('accountant', 'products', 'create', false), ('accountant', 'products', 'edit', false), ('accountant', 'products', 'delete', false), ('accountant', 'products', 'edit_prices', false),
  ('accountant', 'orders', 'view', true), ('accountant', 'orders', 'create', false), ('accountant', 'orders', 'edit', false), ('accountant', 'orders', 'delete', false),
  ('accountant', 'inventory', 'view', true), ('accountant', 'inventory', 'create', true), ('accountant', 'inventory', 'edit', true),
  ('accountant', 'sales', 'view', true), ('accountant', 'sales', 'cancel', false),
  ('accountant', 'pos', 'view', false), ('accountant', 'pos', 'use', false),
  ('accountant', 'invoices', 'view', true), ('accountant', 'invoices', 'create', true), ('accountant', 'invoices', 'edit', true), ('accountant', 'invoices', 'delete', false),
  ('accountant', 'expenses', 'view', true), ('accountant', 'expenses', 'create', true), ('accountant', 'expenses', 'edit', true), ('accountant', 'expenses', 'delete', false),
  ('accountant', 'reports', 'view', true), ('accountant', 'reports', 'export', true),
  ('accountant', 'users', 'view', false), ('accountant', 'users', 'create', false), ('accountant', 'users', 'edit', false), ('accountant', 'users', 'delete', false),
  ('accountant', 'settings', 'view', false), ('accountant', 'settings', 'edit', false),
  ('accountant', 'permissions', 'view', false), ('accountant', 'permissions', 'edit', false),

  -- Employee defaults
  ('employee', 'suppliers', 'view', true), ('employee', 'suppliers', 'create', false), ('employee', 'suppliers', 'edit', false), ('employee', 'suppliers', 'delete', false),
  ('employee', 'products', 'view', true), ('employee', 'products', 'create', true), ('employee', 'products', 'edit', true), ('employee', 'products', 'delete', false), ('employee', 'products', 'edit_prices', false),
  ('employee', 'orders', 'view', true), ('employee', 'orders', 'create', true), ('employee', 'orders', 'edit', true), ('employee', 'orders', 'delete', false),
  ('employee', 'inventory', 'view', true), ('employee', 'inventory', 'create', true), ('employee', 'inventory', 'edit', true),
  ('employee', 'sales', 'view', true), ('employee', 'sales', 'cancel', false),
  ('employee', 'pos', 'view', true), ('employee', 'pos', 'use', true),
  ('employee', 'invoices', 'view', true), ('employee', 'invoices', 'create', false), ('employee', 'invoices', 'edit', false), ('employee', 'invoices', 'delete', false),
  ('employee', 'expenses', 'view', false), ('employee', 'expenses', 'create', false), ('employee', 'expenses', 'edit', false), ('employee', 'expenses', 'delete', false),
  ('employee', 'reports', 'view', false), ('employee', 'reports', 'export', false),
  ('employee', 'users', 'view', false), ('employee', 'users', 'create', false), ('employee', 'users', 'edit', false), ('employee', 'users', 'delete', false),
  ('employee', 'settings', 'view', false), ('employee', 'settings', 'edit', false),
  ('employee', 'permissions', 'view', false), ('employee', 'permissions', 'edit', false);
