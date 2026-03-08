export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          created_by: string | null
          description: string
          expense_date: string
          expense_number: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          created_by?: string | null
          description: string
          expense_date?: string
          expense_number: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          actual_qty: number | null
          barcode: string | null
          created_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          purchase_price: number | null
          session_id: string | null
          system_qty: number | null
          unit: string | null
        }
        Insert: {
          actual_qty?: number | null
          barcode?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          purchase_price?: number | null
          session_id?: string | null
          system_qty?: number | null
          unit?: string | null
        }
        Update: {
          actual_qty?: number | null
          barcode?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          purchase_price?: number | null
          session_id?: string | null
          system_qty?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          session_name: string
          started_at: string | null
          status: string | null
          total_actual_value: number | null
          total_system_value: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          session_name: string
          started_at?: string | null
          status?: string | null
          total_actual_value?: number | null
          total_system_value?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          session_name?: string
          started_at?: string | null
          status?: string | null
          total_actual_value?: number | null
          total_system_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          image_url: string | null
          invoice_date: string
          invoice_number: string
          invoice_type: string | null
          notes: string | null
          paid_amount: number | null
          purchase_order_id: string | null
          status: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          image_url?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          purchase_order_id?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          image_url?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          purchase_order_id?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string | null
          current_stock: number | null
          id: string
          image_thumbnail: string | null
          image_url: string | null
          is_active: boolean | null
          min_stock_alert: number | null
          name: string
          purchase_price: number
          selling_price: number
          supplier_id: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          image_thumbnail?: string | null
          image_url?: string | null
          is_active?: boolean | null
          min_stock_alert?: number | null
          name: string
          purchase_price?: number
          selling_price?: number
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          image_thumbnail?: string | null
          image_url?: string | null
          is_active?: boolean | null
          min_stock_alert?: number | null
          name?: string
          purchase_price?: number
          selling_price?: number
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          actual_purchase_price: number | null
          barcode: string | null
          batch_number: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string | null
          received_qty: number | null
          requested_purchase_price: number | null
          requested_qty: number
          selling_price: number | null
        }
        Insert: {
          actual_purchase_price?: number | null
          barcode?: string | null
          batch_number?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name?: string | null
          received_qty?: number | null
          requested_purchase_price?: number | null
          requested_qty?: number
          selling_price?: number | null
        }
        Update: {
          actual_purchase_price?: number | null
          barcode?: string | null
          batch_number?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string | null
          received_qty?: number | null
          requested_purchase_price?: number | null
          requested_qty?: number
          selling_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          order_number: string
          status: string | null
          supplier_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number: string
          status?: string | null
          supplier_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string
          status?: string | null
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          barcode: string | null
          created_at: string | null
          discount_percent: number | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string | null
          total_price: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id?: string | null
          total_price: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string | null
          total_price?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string | null
          change_amount: number | null
          created_at: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          paid_amount: number
          payment_method: string | null
          sale_number: string
          status: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
        }
        Insert: {
          cashier_id?: string | null
          change_amount?: number | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          sale_number: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
        }
        Update: {
          cashier_id?: string | null
          change_amount?: number | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          sale_number?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          commercial_register: string | null
          company_name: string | null
          contact1_email: string | null
          contact1_name: string | null
          contact1_phone: string | null
          contact1_title: string | null
          contact1_whatsapp: string | null
          contact2_email: string | null
          contact2_name: string | null
          contact2_phone: string | null
          contact2_title: string | null
          contact2_whatsapp: string | null
          country: string | null
          created_at: string | null
          credit_days: number | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          monthly_limit: number | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          rating: number | null
          single_order_limit: number | null
          tax_number: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          commercial_register?: string | null
          company_name?: string | null
          contact1_email?: string | null
          contact1_name?: string | null
          contact1_phone?: string | null
          contact1_title?: string | null
          contact1_whatsapp?: string | null
          contact2_email?: string | null
          contact2_name?: string | null
          contact2_phone?: string | null
          contact2_title?: string | null
          contact2_whatsapp?: string | null
          country?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          monthly_limit?: number | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          single_order_limit?: number | null
          tax_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          commercial_register?: string | null
          company_name?: string | null
          contact1_email?: string | null
          contact1_name?: string | null
          contact1_phone?: string | null
          contact1_title?: string | null
          contact1_whatsapp?: string | null
          contact2_email?: string | null
          contact2_name?: string | null
          contact2_phone?: string | null
          contact2_title?: string | null
          contact2_whatsapp?: string | null
          country?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          monthly_limit?: number | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          single_order_limit?: number | null
          tax_number?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_expense_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_sale_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "accountant" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "accountant", "employee"],
    },
  },
} as const
