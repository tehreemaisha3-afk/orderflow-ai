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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_conversation_messages: {
        Row: {
          business_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          business_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          business_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          business_id: string
          channel: string
          created_at: string
          customer_id: string | null
          escalated: boolean
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          channel?: string
          created_at?: string
          customer_id?: string | null
          escalated?: boolean
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          channel?: string
          created_at?: string
          customer_id?: string | null
          escalated?: boolean
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_processing_logs: {
        Row: {
          business_id: string
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json | null
        }
        Insert: {
          business_id: string
          created_at?: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json | null
        }
        Update: {
          business_id?: string
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_processing_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_processing_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          advance_payment_policy: string | null
          ai_instructions: string | null
          ai_tone: string
          bank_account_number: string | null
          bank_account_title: string | null
          bank_name: string | null
          business_id: string
          canned_messages: Json
          cod_policy: string | null
          created_at: string
          delivery_areas: string[]
          delivery_charge: number
          delivery_methods: string[]
          delivery_time_rules: Json
          escalation_rules: string | null
          free_delivery_threshold: number | null
          payment_instructions: string | null
          payment_methods: string[]
          return_policy: string | null
          shipping_policy: string | null
          updated_at: string
        }
        Insert: {
          advance_payment_policy?: string | null
          ai_instructions?: string | null
          ai_tone?: string
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_name?: string | null
          business_id: string
          canned_messages?: Json
          cod_policy?: string | null
          created_at?: string
          delivery_areas?: string[]
          delivery_charge?: number
          delivery_methods?: string[]
          delivery_time_rules?: Json
          escalation_rules?: string | null
          free_delivery_threshold?: number | null
          payment_instructions?: string | null
          payment_methods?: string[]
          return_policy?: string | null
          shipping_policy?: string | null
          updated_at?: string
        }
        Update: {
          advance_payment_policy?: string | null
          ai_instructions?: string | null
          ai_tone?: string
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_name?: string | null
          business_id?: string
          canned_messages?: Json
          cod_policy?: string | null
          created_at?: string
          delivery_areas?: string[]
          delivery_charge?: number
          delivery_methods?: string[]
          delivery_time_rules?: Json
          escalation_rules?: string | null
          free_delivery_threshold?: number | null
          payment_instructions?: string | null
          payment_methods?: string[]
          return_policy?: string | null
          shipping_policy?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_address: string | null
          business_description: string | null
          business_email: string | null
          business_hours: string | null
          business_name: string
          business_type: string | null
          contact_number: string | null
          created_at: string
          currency: string | null
          id: string
          logo_url: string | null
          owner_id: string
          owner_name: string | null
          timezone: string | null
          updated_at: string
          website: string | null
          whatsapp_number: string | null
        }
        Insert: {
          business_address?: string | null
          business_description?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_name: string
          business_type?: string | null
          contact_number?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          logo_url?: string | null
          owner_id: string
          owner_name?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          business_address?: string | null
          business_description?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_name?: string
          business_type?: string | null
          contact_number?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          logo_url?: string | null
          owner_id?: string
          owner_name?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          city: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          city?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_drafts: {
        Row: {
          business_id: string
          channel: string
          confidence: number
          conversation_id: string | null
          created_at: string
          customer_id: string | null
          detected_language: string | null
          extraction: Json
          id: string
          issues: Json
          order_id: string | null
          reviewed_at: string | null
          reviewer_note: string | null
          source_message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          channel?: string
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          detected_language?: string | null
          extraction?: Json
          id?: string
          issues?: Json
          order_id?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          source_message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          channel?: string
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          customer_id?: string | null
          detected_language?: string | null
          extraction?: Json
          id?: string
          issues?: Json
          order_id?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          source_message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_drafts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_drafts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
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
          ai_conversation_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          customer_notes: string | null
          delivery_address: string | null
          id: string
          inventory_reserved: boolean
          missing_information: string | null
          order_number: string
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          source: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          ai_conversation_id?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_notes?: string | null
          delivery_address?: string | null
          id?: string
          inventory_reserved?: boolean
          missing_information?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          ai_conversation_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_notes?: string | null
          delivery_address?: string | null
          id?: string
          inventory_reserved?: boolean
          missing_information?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_ai_conversation_id_fkey"
            columns: ["ai_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          alias: string
          business_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          alias: string
          business_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          alias?: string
          business_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sku: string | null
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          business_id: string
          created_at: string
          customer_id: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          order_id: string | null
        }
        Insert: {
          body: string
          business_id: string
          created_at?: string
          customer_id?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          order_id?: string | null
        }
        Update: {
          body?: string
          business_id?: string
          created_at?: string
          customer_id?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_order_inventory: {
        Args: { _direction: number; _order_id: string }
        Returns: undefined
      }
      reserve_order_inventory: {
        Args: { _order_id: string }
        Returns: undefined
      }
      user_owns_business: { Args: { _business_id: string }; Returns: boolean }
    }
    Enums: {
      message_direction: "inbound" | "outbound"
      order_status:
        | "new"
        | "awaiting_information"
        | "confirmed"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded"
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
      message_direction: ["inbound", "outbound"],
      order_status: [
        "new",
        "awaiting_information",
        "confirmed",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
    },
  },
} as const
