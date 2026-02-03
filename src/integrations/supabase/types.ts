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
      affiliate_links: {
        Row: {
          blogger_id: string
          clicks: number | null
          conversions: number | null
          created_at: string
          id: string
          is_active: boolean | null
          link_code: string
          product_id: string
          total_commission: number | null
          updated_at: string
        }
        Insert: {
          blogger_id: string
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          link_code: string
          product_id: string
          total_commission?: number | null
          updated_at?: string
        }
        Update: {
          blogger_id?: string
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          link_code?: string
          product_id?: string
          total_commission?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      blogger_balances: {
        Row: {
          available_balance: number | null
          created_at: string
          id: string
          pending_balance: number | null
          total_earned: number | null
          total_withdrawn: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number | null
          created_at?: string
          id?: string
          pending_balance?: number | null
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number | null
          created_at?: string
          id?: string
          pending_balance?: number | null
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name_en: string
          name_ru: string
          name_uz: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name_en: string
          name_ru: string
          name_uz: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name_en?: string
          name_ru?: string
          name_uz?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          affiliate_link_id: string | null
          blogger_id: string
          commission_amount: number
          commission_percent: number
          created_at: string
          id: string
          order_amount: number
          order_id: string | null
          paid_at: string | null
          product_id: string | null
          status: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          blogger_id: string
          commission_amount: number
          commission_percent: number
          created_at?: string
          id?: string
          order_amount: number
          order_id?: string | null
          paid_at?: string | null
          product_id?: string | null
          status?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          blogger_id?: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          order_amount?: number
          order_id?: string | null
          paid_at?: string | null
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          shipping_address: Json | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_revenue: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          source_id?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          affiliate_commission_percent: number | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          is_affiliate_enabled: boolean | null
          name: string
          original_price: number | null
          price: number
          shop_id: string
          source: Database["public"]["Enums"]["product_source"]
          source_url: string | null
          specifications: Json | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          updated_at: string
          view_count: number | null
        }
        Insert: {
          affiliate_commission_percent?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_affiliate_enabled?: boolean | null
          name: string
          original_price?: number | null
          price: number
          shop_id: string
          source?: Database["public"]["Enums"]["product_source"]
          source_url?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          affiliate_commission_percent?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_affiliate_enabled?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          shop_id?: string
          source?: Database["public"]["Enums"]["product_source"]
          source_url?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          view_count?: number | null
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
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["app_language"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?:
            | Database["public"]["Enums"]["app_language"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?:
            | Database["public"]["Enums"]["app_language"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          payment_status: string | null
          plan_type: string
          shop_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          payment_status?: string | null
          plan_type?: string
          shop_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          payment_status?: string | null
          plan_type?: string
          shop_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          rating: number | null
          slug: string
          total_sales: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          rating?: number | null
          slug: string
          total_sales?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          rating?: number | null
          slug?: string
          total_sales?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          phone: string
          region: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          phone: string
          region: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          phone?: string
          region?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          blogger_id: string
          created_at: string
          id: string
          notes: string | null
          payment_details: Json | null
          payment_method: string
          processed_at: string | null
          status: string | null
        }
        Insert: {
          amount: number
          blogger_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method: string
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          blogger_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_affiliate_code: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_product_rating: {
        Args: { p_product_id: string }
        Returns: {
          average_rating: number
          total_reviews: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      track_affiliate_click: {
        Args: { p_link_code: string }
        Returns: undefined
      }
    }
    Enums: {
      app_language: "uz" | "ru" | "en"
      product_source: "manual" | "ai" | "dropshipping"
      product_status: "draft" | "active" | "inactive" | "out_of_stock"
      user_role: "seller" | "blogger" | "buyer" | "admin"
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
      app_language: ["uz", "ru", "en"],
      product_source: ["manual", "ai", "dropshipping"],
      product_status: ["draft", "active", "inactive", "out_of_stock"],
      user_role: ["seller", "blogger", "buyer", "admin"],
    },
  },
} as const
