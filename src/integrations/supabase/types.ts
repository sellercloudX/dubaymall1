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
      admin_permissions: {
        Row: {
          can_add_admins: boolean | null
          can_manage_activations: boolean | null
          can_manage_content: boolean | null
          can_manage_finances: boolean | null
          can_manage_orders: boolean | null
          can_manage_products: boolean | null
          can_manage_shops: boolean | null
          can_manage_users: boolean | null
          created_at: string | null
          granted_by: string | null
          id: string
          is_super_admin: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_add_admins?: boolean | null
          can_manage_activations?: boolean | null
          can_manage_content?: boolean | null
          can_manage_finances?: boolean | null
          can_manage_orders?: boolean | null
          can_manage_products?: boolean | null
          can_manage_shops?: boolean | null
          can_manage_users?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          is_super_admin?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_add_admins?: boolean | null
          can_manage_activations?: boolean | null
          can_manage_content?: boolean | null
          can_manage_finances?: boolean | null
          can_manage_orders?: boolean | null
          can_manage_products?: boolean | null
          can_manage_shops?: boolean | null
          can_manage_users?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          is_super_admin?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      ai_usage_log: {
        Row: {
          action_type: string
          created_at: string
          estimated_cost_usd: number | null
          id: string
          metadata: Json | null
          model_used: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          model_used?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          model_used?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          clicks_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string
          is_active: boolean | null
          link_id: string | null
          link_type: string | null
          link_url: string | null
          position: string | null
          priority: number | null
          start_date: string | null
          title: string
          views_count: number | null
        }
        Insert: {
          clicks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_id?: string | null
          link_type?: string | null
          link_url?: string | null
          position?: string | null
          priority?: number | null
          start_date?: string | null
          title: string
          views_count?: number | null
        }
        Update: {
          clicks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_id?: string | null
          link_type?: string | null
          link_url?: string | null
          position?: string | null
          priority?: number | null
          start_date?: string | null
          title?: string
          views_count?: number | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string
          category: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          author_id: string
          category?: string | null
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          author_id?: string
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: []
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
      blogger_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          followers_count: number | null
          id: string
          niche: string | null
          payment_details: Json | null
          payment_method: string | null
          rejection_reason: string | null
          screenshots: string[] | null
          social_platform: string
          social_url: string | null
          social_username: string | null
          status: string
          submitted_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          followers_count?: number | null
          id?: string
          niche?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          rejection_reason?: string | null
          screenshots?: string[] | null
          social_platform: string
          social_url?: string | null
          social_username?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          followers_count?: number | null
          id?: string
          niche?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          rejection_reason?: string | null
          screenshots?: string[] | null
          social_platform?: string
          social_url?: string | null
          social_username?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
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
      category_commissions: {
        Row: {
          category_id: string | null
          commission_percent: number
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          commission_percent?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          commission_percent?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_commissions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
            foreignKeyName: "commissions_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links_public"
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
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_message_at: string | null
          product_id: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string | null
          product_id?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string | null
          product_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      dropshipping_orders: {
        Row: {
          created_at: string
          delivered_at: string | null
          estimated_delivery_days: string | null
          id: string
          notes: string | null
          order_id: string
          order_item_id: string
          ordered_at: string | null
          product_id: string
          quantity: number
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number
          shipping_method: string | null
          shop_id: string
          supplier_cost: number
          supplier_order_id: string | null
          supplier_order_status: string | null
          supplier_platform: string
          supplier_response: Json | null
          total_cost: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          variant_id: string | null
          variant_sku: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          estimated_delivery_days?: string | null
          id?: string
          notes?: string | null
          order_id: string
          order_item_id: string
          ordered_at?: string | null
          product_id: string
          quantity?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_method?: string | null
          shop_id: string
          supplier_cost?: number
          supplier_order_id?: string | null
          supplier_order_status?: string | null
          supplier_platform?: string
          supplier_response?: Json | null
          total_cost?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          variant_id?: string | null
          variant_sku?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          estimated_delivery_days?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          order_item_id?: string
          ordered_at?: string | null
          product_id?: string
          quantity?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_method?: string | null
          shop_id?: string
          supplier_cost?: number
          supplier_order_id?: string | null
          supplier_order_status?: string | null
          supplier_platform?: string
          supplier_response?: Json | null
          total_cost?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          variant_id?: string | null
          variant_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dropshipping_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropshipping_orders_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropshipping_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropshipping_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropshipping_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
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
      flash_sale_products: {
        Row: {
          created_at: string | null
          flash_sale_id: string | null
          id: string
          product_id: string | null
          sale_price: number
          sold_count: number | null
          stock_limit: number | null
        }
        Insert: {
          created_at?: string | null
          flash_sale_id?: string | null
          id?: string
          product_id?: string | null
          sale_price: number
          sold_count?: number | null
          stock_limit?: number | null
        }
        Update: {
          created_at?: string | null
          flash_sale_id?: string | null
          id?: string
          product_id?: string | null
          sale_price?: number
          sold_count?: number | null
          stock_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flash_sale_products_flash_sale_id_fkey"
            columns: ["flash_sale_id"]
            isOneToOne: false
            referencedRelation: "flash_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sales: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_percent: number | null
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      logistics_orders: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          barcode: string
          confirmation_code: string
          courier_assigned_at: string | null
          courier_id: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          customer_telegram: string | null
          delivered_at: string | null
          delivery_otp: string | null
          delivery_otp_expires_at: string | null
          delivery_type: string
          dubaymall_order_id: string | null
          id: string
          notes: string | null
          payment_amount: number | null
          product_name: string | null
          seller_name: string | null
          status: string
          status_history: Json | null
          target_point_id: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          barcode: string
          confirmation_code: string
          courier_assigned_at?: string | null
          courier_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          customer_telegram?: string | null
          delivered_at?: string | null
          delivery_otp?: string | null
          delivery_otp_expires_at?: string | null
          delivery_type: string
          dubaymall_order_id?: string | null
          id?: string
          notes?: string | null
          payment_amount?: number | null
          product_name?: string | null
          seller_name?: string | null
          status?: string
          status_history?: Json | null
          target_point_id?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          barcode?: string
          confirmation_code?: string
          courier_assigned_at?: string | null
          courier_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          customer_telegram?: string | null
          delivered_at?: string | null
          delivery_otp?: string | null
          delivery_otp_expires_at?: string | null
          delivery_type?: string
          dubaymall_order_id?: string | null
          id?: string
          notes?: string | null
          payment_amount?: number | null
          product_name?: string | null
          seller_name?: string | null
          status?: string
          status_history?: Json | null
          target_point_id?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_connections: {
        Row: {
          account_info: Json | null
          created_at: string
          credentials: Json
          encrypted_credentials: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          marketplace: string
          orders_count: number | null
          products_count: number | null
          shop_id: string | null
          total_revenue: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_info?: Json | null
          created_at?: string
          credentials?: Json
          encrypted_credentials?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          marketplace: string
          orders_count?: number | null
          products_count?: number | null
          shop_id?: string | null
          total_revenue?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_info?: Json | null
          created_at?: string
          credentials?: Json
          encrypted_credentials?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          marketplace?: string
          orders_count?: number | null
          products_count?: number | null
          shop_id?: string | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_connections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_connections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_cost_prices: {
        Row: {
          cost_price: number
          created_at: string
          currency: string
          id: string
          marketplace: string
          notes: string | null
          offer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          currency?: string
          id?: string
          marketplace: string
          notes?: string | null
          offer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          currency?: string
          id?: string
          marketplace?: string
          notes?: string | null
          offer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_orders_cache: {
        Row: {
          created_at: string
          data: Json
          id: string
          marketplace: string
          order_id: string
          status: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          marketplace: string
          order_id: string
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          marketplace?: string
          order_id?: string
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_products_cache: {
        Row: {
          created_at: string
          data: Json
          id: string
          marketplace: string
          offer_id: string
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          marketplace: string
          offer_id: string
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          marketplace?: string
          offer_id?: string
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_stats_cache: {
        Row: {
          data: Json
          id: string
          low_stock_count: number | null
          marketplace: string
          pending_orders: number | null
          stats_date: string
          synced_at: string
          total_orders: number | null
          total_products: number | null
          total_revenue: number | null
          user_id: string
        }
        Insert: {
          data?: Json
          id?: string
          low_stock_count?: number | null
          marketplace: string
          pending_orders?: number | null
          stats_date?: string
          synced_at?: string
          total_orders?: number | null
          total_products?: number | null
          total_revenue?: number | null
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
          low_stock_count?: number | null
          marketplace?: string
          pending_orders?: number | null
          stats_date?: string
          synced_at?: string
          total_orders?: number | null
          total_products?: number | null
          total_revenue?: number | null
          user_id?: string
        }
        Relationships: []
      }
      mxik_codes: {
        Row: {
          code: string
          created_at: string | null
          group_code: string | null
          group_name: string | null
          id: string
          is_active: boolean | null
          name_ru: string | null
          name_uz: string
          search_vector: unknown
          unit_code: string | null
          unit_name: string | null
          vat_rate: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          group_code?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean | null
          name_ru?: string | null
          name_uz: string
          search_vector?: unknown
          unit_code?: string | null
          unit_name?: string | null
          vat_rate?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          group_code?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean | null
          name_ru?: string | null
          name_uz?: string
          search_vector?: unknown
          unit_code?: string | null
          unit_name?: string | null
          vat_rate?: number | null
        }
        Relationships: []
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
      order_financials: {
        Row: {
          affiliate_link_id: string | null
          blogger_commission_amount: number | null
          blogger_commission_percent: number | null
          blogger_id: string | null
          created_at: string
          id: string
          is_dropshipping: boolean | null
          order_id: string
          order_total: number
          payout_available_at: string | null
          payout_completed_at: string | null
          payout_status: string | null
          platform_commission_amount: number
          platform_commission_percent: number
          seller_net_amount: number
          seller_profit: number | null
          shipping_cost: number | null
          shop_id: string
          supplier_cost: number | null
        }
        Insert: {
          affiliate_link_id?: string | null
          blogger_commission_amount?: number | null
          blogger_commission_percent?: number | null
          blogger_id?: string | null
          created_at?: string
          id?: string
          is_dropshipping?: boolean | null
          order_id: string
          order_total: number
          payout_available_at?: string | null
          payout_completed_at?: string | null
          payout_status?: string | null
          platform_commission_amount: number
          platform_commission_percent: number
          seller_net_amount: number
          seller_profit?: number | null
          shipping_cost?: number | null
          shop_id: string
          supplier_cost?: number | null
        }
        Update: {
          affiliate_link_id?: string | null
          blogger_commission_amount?: number | null
          blogger_commission_percent?: number | null
          blogger_id?: string | null
          created_at?: string
          id?: string
          is_dropshipping?: boolean | null
          order_id?: string
          order_total?: number
          payout_available_at?: string | null
          payout_completed_at?: string | null
          payout_status?: string | null
          platform_commission_amount?: number
          platform_commission_percent?: number
          seller_net_amount?: number
          seller_profit?: number | null
          shipping_cost?: number | null
          shop_id?: string
          supplier_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_financials_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_financials_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_financials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_financials_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_financials_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
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
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_otp: string | null
          delivery_otp_expires_at: string | null
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
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_otp?: string | null
          delivery_otp_expires_at?: string | null
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
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_otp?: string | null
          delivery_otp_expires_at?: string | null
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
      platform_expenses: {
        Row: {
          amount: number
          category: string | null
          connection_id: string | null
          created_at: string
          currency: string
          description: string | null
          expense_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          connection_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expense_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          connection_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expense_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
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
      product_variants: {
        Row: {
          created_at: string
          hex_color: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          price_adjustment: number | null
          product_id: string
          sort_order: number | null
          stock_quantity: number | null
          updated_at: string
          variant_label: string | null
          variant_type: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          hex_color?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          price_adjustment?: number | null
          product_id: string
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string
          variant_label?: string | null
          variant_type: string
          variant_value: string
        }
        Update: {
          created_at?: string
          hex_color?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          price_adjustment?: number | null
          product_id?: string
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string
          variant_label?: string | null
          variant_type?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_commission_percent: number | null
          category_id: string | null
          created_at: string
          description: string | null
          free_shipping: boolean | null
          id: string
          images: string[] | null
          is_affiliate_enabled: boolean | null
          mxik_code: string | null
          mxik_name: string | null
          name: string
          original_price: number | null
          preparation_days: number | null
          price: number
          shipping_price: number | null
          shop_id: string
          source: Database["public"]["Enums"]["product_source"]
          source_url: string | null
          specifications: Json | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          updated_at: string
          view_count: number | null
          weight_kg: number | null
        }
        Insert: {
          affiliate_commission_percent?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          free_shipping?: boolean | null
          id?: string
          images?: string[] | null
          is_affiliate_enabled?: boolean | null
          mxik_code?: string | null
          mxik_name?: string | null
          name: string
          original_price?: number | null
          preparation_days?: number | null
          price: number
          shipping_price?: number | null
          shop_id: string
          source?: Database["public"]["Enums"]["product_source"]
          source_url?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          view_count?: number | null
          weight_kg?: number | null
        }
        Update: {
          affiliate_commission_percent?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          free_shipping?: boolean | null
          id?: string
          images?: string[] | null
          is_affiliate_enabled?: boolean | null
          mxik_code?: string | null
          mxik_name?: string | null
          name?: string
          original_price?: number | null
          preparation_days?: number | null
          price?: number
          shipping_price?: number | null
          shop_id?: string
          source?: Database["public"]["Enums"]["product_source"]
          source_url?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          view_count?: number | null
          weight_kg?: number | null
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
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["app_language"] | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?:
            | Database["public"]["Enums"]["app_language"]
            | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?:
            | Database["public"]["Enums"]["app_language"]
            | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          budget: number | null
          clicks_count: number | null
          conversions: number | null
          created_at: string | null
          daily_budget: number | null
          end_date: string | null
          id: string
          product_id: string | null
          shop_id: string | null
          spent: number | null
          start_date: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
          views_count: number | null
        }
        Insert: {
          budget?: number | null
          clicks_count?: number | null
          conversions?: number | null
          created_at?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          product_id?: string | null
          shop_id?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          views_count?: number | null
        }
        Update: {
          budget?: number | null
          clicks_count?: number | null
          conversions?: number | null
          created_at?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          product_id?: string | null
          shop_id?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_shipping_rates: {
        Row: {
          base_rate: number
          created_at: string | null
          id: string
          is_active: boolean | null
          per_kg_rate: number | null
          region_id: string | null
          updated_at: string | null
        }
        Insert: {
          base_rate?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          per_kg_rate?: number | null
          region_id?: string | null
          updated_at?: string | null
        }
        Update: {
          base_rate?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          per_kg_rate?: number | null
          region_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regional_shipping_rates_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name_ru: string | null
          name_uz: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name_ru?: string | null
          name_uz: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name_ru?: string | null
          name_uz?: string
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
      seller_balances: {
        Row: {
          available_balance: number | null
          created_at: string
          id: string
          pending_balance: number | null
          shop_id: string
          total_earned: number | null
          total_withdrawn: number | null
          updated_at: string
        }
        Insert: {
          available_balance?: number | null
          created_at?: string
          id?: string
          pending_balance?: number | null
          shop_id: string
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string
        }
        Update: {
          available_balance?: number | null
          created_at?: string
          id?: string
          pending_balance?: number | null
          shop_id?: string
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_balances_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_balances_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bank_account: string | null
          bank_mfo: string | null
          bank_name: string | null
          business_name: string | null
          business_type: string
          contact_phone: string | null
          created_at: string | null
          id: string
          inn: string | null
          legal_address: string | null
          oked: string | null
          rejection_reason: string | null
          shop_id: string | null
          status: string
          submitted_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_mfo?: string | null
          bank_name?: string | null
          business_name?: string | null
          business_type?: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          inn?: string | null
          legal_address?: string | null
          oked?: string | null
          rejection_reason?: string | null
          shop_id?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_mfo?: string | null
          bank_name?: string | null
          business_name?: string | null
          business_type?: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          inn?: string | null
          legal_address?: string | null
          oked?: string | null
          rejection_reason?: string | null
          shop_id?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
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
          {
            foreignKeyName: "seller_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_details: Json | null
          payment_method: string
          processed_at: string | null
          shop_id: string
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method: string
          processed_at?: string | null
          shop_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string
          processed_at?: string | null
          shop_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_withdrawal_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_withdrawal_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sellercloud_billing: {
        Row: {
          balance_due: number
          billing_period_end: string
          billing_period_start: string
          commission_percent: number
          created_at: string
          id: string
          monthly_fee_amount: number
          paid_at: string | null
          sales_commission_amount: number
          status: string
          subscription_id: string | null
          total_due: number
          total_paid: number
          total_sales_volume: number
          updated_at: string
          user_id: string
          waived_by: string | null
          waived_reason: string | null
        }
        Insert: {
          balance_due?: number
          billing_period_end: string
          billing_period_start: string
          commission_percent?: number
          created_at?: string
          id?: string
          monthly_fee_amount?: number
          paid_at?: string | null
          sales_commission_amount?: number
          status?: string
          subscription_id?: string | null
          total_due?: number
          total_paid?: number
          total_sales_volume?: number
          updated_at?: string
          user_id: string
          waived_by?: string | null
          waived_reason?: string | null
        }
        Update: {
          balance_due?: number
          billing_period_end?: string
          billing_period_start?: string
          commission_percent?: number
          created_at?: string
          id?: string
          monthly_fee_amount?: number
          paid_at?: string | null
          sales_commission_amount?: number
          status?: string
          subscription_id?: string | null
          total_due?: number
          total_paid?: number
          total_sales_volume?: number
          updated_at?: string
          user_id?: string
          waived_by?: string | null
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sellercloud_billing_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "sellercloud_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sellercloud_payments: {
        Row: {
          amount: number
          billing_id: string | null
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          payment_reference: string | null
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method: string
          payment_reference?: string | null
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellercloud_payments_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "sellercloud_billing"
            referencedColumns: ["id"]
          },
        ]
      }
      sellercloud_subscriptions: {
        Row: {
          admin_notes: string | null
          admin_override: boolean
          commission_percent: number
          created_at: string
          expires_at: string | null
          id: string
          initial_payment_at: string | null
          initial_payment_completed: boolean | null
          is_active: boolean
          is_trial: boolean
          marketplace_connected: boolean | null
          monthly_fee: number
          plan_type: string
          profile_completed: boolean | null
          started_at: string
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          admin_override?: boolean
          commission_percent?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          initial_payment_at?: string | null
          initial_payment_completed?: boolean | null
          is_active?: boolean
          is_trial?: boolean
          marketplace_connected?: boolean | null
          monthly_fee?: number
          plan_type?: string
          profile_completed?: boolean | null
          started_at?: string
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          admin_override?: boolean
          commission_percent?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          initial_payment_at?: string | null
          initial_payment_completed?: boolean | null
          is_active?: boolean
          is_trial?: boolean
          marketplace_connected?: boolean | null
          monthly_fee?: number
          plan_type?: string
          profile_completed?: boolean | null
          started_at?: string
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      wildberries_connections: {
        Row: {
          account_info: Json | null
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          orders_count: number | null
          products_count: number | null
          supplier_id: number
          total_revenue: number | null
          updated_at: string | null
          user_id: string
          warehouse_id: number | null
        }
        Insert: {
          account_info?: Json | null
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          orders_count?: number | null
          products_count?: number | null
          supplier_id: number
          total_revenue?: number | null
          updated_at?: string | null
          user_id: string
          warehouse_id?: number | null
        }
        Update: {
          account_info?: Json | null
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          orders_count?: number | null
          products_count?: number | null
          supplier_id?: number
          total_revenue?: number | null
          updated_at?: string | null
          user_id?: string
          warehouse_id?: number | null
        }
        Relationships: []
      }
      wildberries_financials: {
        Row: {
          commission: number | null
          connection_id: string
          created_at: string | null
          date: string | null
          id: string
          logistics: number | null
          net_income: number | null
          order_id: number
          penalty: number | null
          return_amount: number | null
          revenue: number | null
          user_id: string
        }
        Insert: {
          commission?: number | null
          connection_id: string
          created_at?: string | null
          date?: string | null
          id?: string
          logistics?: number | null
          net_income?: number | null
          order_id: number
          penalty?: number | null
          return_amount?: number | null
          revenue?: number | null
          user_id: string
        }
        Update: {
          commission?: number | null
          connection_id?: string
          created_at?: string | null
          date?: string | null
          id?: string
          logistics?: number | null
          net_income?: number | null
          order_id?: number
          penalty?: number | null
          return_amount?: number | null
          revenue?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wildberries_financials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "wildberries_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      wildberries_orders: {
        Row: {
          buyer_name: string | null
          commission_amount: number | null
          commission_percent: number | null
          connection_id: string
          created_at: string | null
          delivery_address: string | null
          id: string
          items: Json | null
          order_date: string | null
          order_id: number
          payment_method: string | null
          status: string | null
          total_amount: number | null
          total_price: number | null
          updated_at: string | null
          user_id: string
          warehouse_id: number | null
        }
        Insert: {
          buyer_name?: string | null
          commission_amount?: number | null
          commission_percent?: number | null
          connection_id: string
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          items?: Json | null
          order_date?: string | null
          order_id: number
          payment_method?: string | null
          status?: string | null
          total_amount?: number | null
          total_price?: number | null
          updated_at?: string | null
          user_id: string
          warehouse_id?: number | null
        }
        Update: {
          buyer_name?: string | null
          commission_amount?: number | null
          commission_percent?: number | null
          connection_id?: string
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          items?: Json | null
          order_date?: string | null
          order_id?: number
          payment_method?: string | null
          status?: string | null
          total_amount?: number | null
          total_price?: number | null
          updated_at?: string | null
          user_id?: string
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wildberries_orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "wildberries_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      wildberries_products: {
        Row: {
          category_id: number | null
          connection_id: string
          created_at: string | null
          discount_percent: number | null
          id: string
          images: string[] | null
          nm_id: number
          price: number | null
          rating: number | null
          review_count: number | null
          stock: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id?: number | null
          connection_id: string
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          images?: string[] | null
          nm_id: number
          price?: number | null
          rating?: number | null
          review_count?: number | null
          stock?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: number | null
          connection_id?: string
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          images?: string[] | null
          nm_id?: number
          price?: number | null
          rating?: number | null
          review_count?: number | null
          stock?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wildberries_products_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "wildberries_connections"
            referencedColumns: ["id"]
          },
        ]
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
      affiliate_links_public: {
        Row: {
          id: string | null
          is_active: boolean | null
          product_id: string | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          product_id?: string | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          product_id?: string | null
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
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reviews_public: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          is_verified_purchase: boolean | null
          product_id: string | null
          rating: number | null
          reviewer_avatar: string | null
          reviewer_name: string | null
          updated_at: string | null
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
      shops_public: {
        Row: {
          banner_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          rating: number | null
          slug: string | null
          total_sales: number | null
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          rating?: number | null
          slug?: string | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          rating?: number | null
          slug?: string | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_order_financials: {
        Args: { p_order_id: string; p_platform_commission_percent?: number }
        Returns: Json
      }
      calculate_sellercloud_billing: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_total_sales: number
          p_user_id: string
        }
        Returns: Json
      }
      can_add_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      check_sellercloud_access: { Args: { p_user_id: string }; Returns: Json }
      decrypt_credentials: { Args: { p_encrypted: string }; Returns: Json }
      encrypt_credentials: { Args: { p_credentials: Json }; Returns: string }
      generate_affiliate_code: { Args: never; Returns: string }
      generate_confirmation_code: { Args: never; Returns: string }
      generate_delivery_otp: { Args: { p_order_id: string }; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_product_rating: {
        Args: { p_product_id: string }
        Returns: {
          average_rating: number
          total_reviews: number
        }[]
      }
      has_admin_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_view_count: { Args: { product_id: string }; Returns: undefined }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      process_pending_payouts: { Args: never; Returns: number }
      search_products_fuzzy: {
        Args: {
          category_filter?: string
          page_limit?: number
          page_offset?: number
          search_term: string
          sort_type?: string
        }
        Returns: {
          affiliate_commission_percent: number
          category_id: string
          created_at: string
          description: string
          free_shipping: boolean
          id: string
          images: string[]
          is_affiliate_enabled: boolean
          mxik_code: string
          mxik_name: string
          name: string
          original_price: number
          preparation_days: number
          price: number
          shipping_price: number
          shop_id: string
          shop_name: string
          shop_slug: string
          similarity_score: number
          source: string
          source_url: string
          specifications: Json
          status: string
          stock_quantity: number
          updated_at: string
          view_count: number
          weight_kg: number
        }[]
      }
      seller_has_order_products: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      track_affiliate_click: {
        Args: { p_link_code: string }
        Returns: undefined
      }
      update_logistics_status: {
        Args: {
          p_actor_id?: string
          p_barcode: string
          p_new_status: string
          p_note?: string
        }
        Returns: Json
      }
      user_owns_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      verify_delivery_otp: {
        Args: { p_order_id: string; p_otp: string }
        Returns: Json
      }
      verify_logistics_otp: {
        Args: { p_barcode: string; p_otp: string }
        Returns: Json
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
