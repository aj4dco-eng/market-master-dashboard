# CLAUDE.md — Market Master Dashboard

This file provides guidance for AI assistants working on this codebase.

---

## Project Overview

**Market Master Dashboard** is a production-ready supermarket management system built with React/TypeScript and Supabase. It supports multi-role access control (Admin, Accountant, Employee), real-time data, offline PWA capabilities, and a full Arabic/RTL UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, TypeScript 5.8, Vite 5.4 |
| UI Components | shadcn-ui + Tailwind CSS 3.4 |
| Icons | Lucide React |
| Routing | React Router DOM 6 |
| Server State | TanStack React Query 5 |
| Forms | React Hook Form + Zod |
| Backend/DB | Supabase (PostgreSQL + Auth) |
| Charts | Recharts |
| Testing | Vitest + React Testing Library |
| PWA | vite-plugin-pwa (Workbox) |
| Compiler | Vite SWC |

---

## Repository Structure

```
src/
├── components/
│   ├── ui/              # 60+ shadcn-ui primitives (Button, Dialog, Table, etc.)
│   ├── orders/          # Order-related dialogs
│   ├── products/        # Product-related dialogs
│   ├── suppliers/       # Supplier-related dialogs
│   ├── AppSidebar.tsx   # Navigation sidebar
│   ├── DashboardLayout.tsx
│   ├── TopBar.tsx
│   ├── ProtectedRoute.tsx
│   ├── PWAInstallBanner.tsx
│   └── OfflineIndicator.tsx
├── pages/
│   ├── dashboard/
│   │   ├── AdminDashboard.tsx
│   │   ├── AccountantDashboard.tsx
│   │   └── EmployeeDashboard.tsx
│   ├── ProductsPage.tsx
│   ├── SuppliersPage.tsx
│   ├── PurchaseOrdersPage.tsx
│   ├── InventoryPage.tsx
│   ├── SalesPage.tsx
│   ├── POSPage.tsx          # Point of Sale (large, ~27KB)
│   ├── InvoicesPage.tsx     # (~24KB)
│   ├── ExpensesPage.tsx
│   ├── ReportsPage.tsx      # Analytics (~30KB)
│   ├── PermissionsPage.tsx
│   ├── UsersPage.tsx
│   ├── SettingsPage.tsx
│   ├── Login.tsx
│   └── NotFound.tsx
├── contexts/
│   └── AuthContext.tsx      # Auth state, session, user role
├── hooks/
│   ├── usePermissions.ts    # Granular permission checking
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── integrations/
│   └── supabase/
│       ├── client.ts        # Supabase client (localStorage, auto-refresh)
│       └── types.ts         # Auto-generated DB TypeScript types
├── lib/
│   └── utils.ts             # cn() classname helper
└── test/
    ├── setup.ts             # Mocks window.matchMedia
    └── example.test.ts
supabase/
├── config.toml
└── migrations/              # 9 migration files
```

---

## Development Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Dev-mode build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
npm run test         # Run all tests once
npm run test:watch   # Run tests in watch mode
```

---

## Environment Variables

Stored in `.env` (Vite prefix required):

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-id>
```

Access via `import.meta.env.VITE_*`. Never use `process.env` — this is a Vite project.

---

## Path Aliases

```ts
import Foo from '@/components/Foo'  // resolves to src/components/Foo
```

Configured in `vite.config.ts` and `tsconfig.json`.

---

## Authentication & Authorization

### Auth Flow

```
Login.tsx → AuthContext (session/role) → ProtectedRoute → Page
```

`AuthContext` (`src/contexts/AuthContext.tsx`) provides:
- `user` — Supabase auth user
- `profile` — row from `profiles` table
- `userRole` — string: `"admin"` | `"accountant"` | `"employee"`
- `loading` — boolean
- `signOut()`

### Role-Based Access

Three roles with distinct access levels:

| Role | Access |
|---|---|
| `admin` | Full access to all modules |
| `accountant` | Inventory, invoices, expenses, reports, sales (view/cancel) |
| `employee` | Products, orders, inventory, POS, sales (view only) |

### Permission System

`usePermissions()` hook (src/hooks/usePermissions.ts):
- Queries `role_permissions` table for role-level defaults
- Queries `user_permission_overrides` for individual exceptions
- Returns: `hasPermission(module, action)`, `canView()`, `canCreate()`, `canEdit()`, `canDelete()`

**Modules:** `suppliers`, `products`, `orders`, `inventory`, `sales`, `pos`, `invoices`, `expenses`, `reports`, `users`, `settings`, `permissions`

**Actions:** `view`, `create`, `edit`, `delete`, `edit_prices`, `use`, `cancel`, `export`

---

## Database (Supabase)

### Key Tables

| Table | Description |
|---|---|
| `profiles` | User profile data |
| `categories` | Product categories |
| `products` | SKU, stock, prices, barcode |
| `suppliers` | Supplier info |
| `purchase_orders` | Purchase order headers |
| `order_items` | Line items for orders |
| `inventory_items` | Physical inventory records |
| `sales` | Sales records |
| `invoices` | Invoice documents |
| `expenses` | Expense tracking |
| `user_roles` | Maps users to roles |
| `role_permissions` | Default permissions by role |
| `user_permission_overrides` | Per-user permission exceptions |

### RPC Functions

- `get_user_role(user_id)` — returns the user's role string
- `check_permission(user_id, module, action)` — checks if user has permission

### Data Access Pattern

Always use TanStack React Query for data fetching:

```ts
const { data, isLoading } = useQuery({
  queryKey: ['products'],
  queryFn: async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return data;
  },
});
```

Invalidate queries after mutations:
```ts
queryClient.invalidateQueries({ queryKey: ['products'] });
```

---

## UI & Styling Conventions

### Components

- Use components from `src/components/ui/` (shadcn-ui). Do not add raw HTML for things that have existing shadcn primitives.
- Prefer Dialog-based CRUD modals (see existing dialogs in `components/orders/`, `components/products/`, etc.)
- Use `cn()` from `src/lib/utils.ts` for conditional classnames.

### Tailwind

- Custom colors via CSS variables: `bg-primary`, `text-muted-foreground`, etc.
- Dark mode via `.dark` class on `<html>` (toggled by `next-themes`)
- RTL layout: `html` has `dir="rtl"` and `lang="ar"`
- Font: Tajawal (Arabic)

### Toast Notifications

Use the `sonner` library via the `useToast` hook or direct `toast()` calls:
```ts
import { toast } from 'sonner';
toast.success('تم الحفظ بنجاح');
toast.error('حدث خطأ');
```

---

## Localization

- **Language:** Arabic
- **Direction:** RTL (Right-to-Left)
- **Currency:** NIS (₪) — formatted as `₪ 1,234.56`
- **Dates:** Arabic month names, `dd/mm/yyyy` style
- All user-visible strings must be in Arabic. Do not add English UI strings.

---

## Testing

- **Framework:** Vitest
- **Environment:** jsdom
- **Setup:** `src/test/setup.ts` (mocks `window.matchMedia`)
- **Test files:** colocate at `src/**/*.test.{ts,tsx}` or in `src/test/`
- Run: `npm run test`

Write tests using React Testing Library patterns. Mock Supabase calls when testing components.

---

## PWA

The app is installable as a PWA:
- Manifest configured in `vite.config.ts` with Arabic name/description
- Service worker uses Workbox runtime caching for Supabase API calls
- `OfflineIndicator` shows when network is unavailable
- `PWAInstallBanner` prompts installation

Do not remove or modify the PWA plugin configuration without ensuring offline functionality is preserved.

---

## TypeScript

- `tsconfig.json` uses lenient settings: `noImplicitAny: false`, no strict mode
- Database types are auto-generated at `src/integrations/supabase/types.ts` — do not hand-edit this file
- Import path alias: `@/` → `src/`

---

## Key Conventions

1. **No raw SQL** — always use the Supabase client (`supabase.from(...)`, RPC calls)
2. **Permission checks** — always use `usePermissions()` before showing sensitive UI or allowing actions
3. **Role dashboards** — each role gets its own dashboard component; do not merge them
4. **Large pages** — POSPage, InvoicesPage, ReportsPage are large; prefer adding sub-components rather than expanding them further
5. **Dialog CRUD** — follow existing pattern: separate `Add*Dialog`, `Edit*Dialog`, `Delete*Dialog` components per feature
6. **Query keys** — use descriptive array keys: `['products']`, `['orders', orderId]`
7. **Error handling** — always show a toast on Supabase errors; never silently swallow errors
8. **RTL awareness** — when adding layout (flex row, margins, padding), verify it looks correct in RTL

---

## Common Gotchas

- The dev server runs on **port 8080** (not the default 5173)
- Vite env vars must be prefixed with `VITE_` — otherwise they are not exposed to the client
- `supabase/types.ts` is auto-generated; regenerate it with the Supabase CLI when schema changes
- The app uses `dir="rtl"` globally; be careful with directional CSS (e.g., `ml-*` and `mr-*` are swapped visually)
- `next-themes` manages dark/light mode — use `useTheme()` to read/set theme, not manual DOM manipulation
