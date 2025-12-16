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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          input_file_path: string | null
          input_filename: string
          last_period: string | null
          log: Json | null
          mode: Database["public"]["Enums"]["run_mode"]
          period_end: string | null
          period_start: string | null
          periods_found: number | null
          processed_file_path: string | null
          processing_time_ms: number | null
          result_file_path: string | null
          rows_processed: number | null
          status: Database["public"]["Enums"]["run_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_file_path?: string | null
          input_filename: string
          last_period?: string | null
          log?: Json | null
          mode: Database["public"]["Enums"]["run_mode"]
          period_end?: string | null
          period_start?: string | null
          periods_found?: number | null
          processed_file_path?: string | null
          processing_time_ms?: number | null
          result_file_path?: string | null
          rows_processed?: number | null
          status?: Database["public"]["Enums"]["run_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_file_path?: string | null
          input_filename?: string
          last_period?: string | null
          log?: Json | null
          mode?: Database["public"]["Enums"]["run_mode"]
          period_end?: string | null
          period_start?: string | null
          periods_found?: number | null
          processed_file_path?: string | null
          processing_time_ms?: number | null
          result_file_path?: string | null
          rows_processed?: number | null
          status?: Database["public"]["Enums"]["run_status"]
          user_id?: string
        }
        Relationships: []
      }
      sales_analytics: {
        Row: {
          abc_group: string | null
          article: string
          avg_monthly_qty: number | null
          avg_price: number | null
          category: string | null
          coefficient_of_variation: number | null
          created_at: string | null
          cumulative_share: number | null
          current_stock: number | null
          days_until_stockout: number | null
          group_code: string | null
          id: string
          plan_1m: number | null
          plan_3m: number | null
          plan_6m: number | null
          product_group: string | null
          recommendation: string | null
          revenue_share: number | null
          run_id: string
          sales_velocity_day: number | null
          total_quantity: number | null
          total_revenue: number | null
          xyz_group: string | null
        }
        Insert: {
          abc_group?: string | null
          article: string
          avg_monthly_qty?: number | null
          avg_price?: number | null
          category?: string | null
          coefficient_of_variation?: number | null
          created_at?: string | null
          cumulative_share?: number | null
          current_stock?: number | null
          days_until_stockout?: number | null
          group_code?: string | null
          id?: string
          plan_1m?: number | null
          plan_3m?: number | null
          plan_6m?: number | null
          product_group?: string | null
          recommendation?: string | null
          revenue_share?: number | null
          run_id: string
          sales_velocity_day?: number | null
          total_quantity?: number | null
          total_revenue?: number | null
          xyz_group?: string | null
        }
        Update: {
          abc_group?: string | null
          article?: string
          avg_monthly_qty?: number | null
          avg_price?: number | null
          category?: string | null
          coefficient_of_variation?: number | null
          created_at?: string | null
          cumulative_share?: number | null
          current_stock?: number | null
          days_until_stockout?: number | null
          group_code?: string | null
          id?: string
          plan_1m?: number | null
          plan_3m?: number | null
          plan_6m?: number | null
          product_group?: string | null
          recommendation?: string | null
          revenue_share?: number | null
          run_id?: string
          sales_velocity_day?: number | null
          total_quantity?: number | null
          total_revenue?: number | null
          xyz_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_data: {
        Row: {
          article: string
          avg_price: number | null
          category: string | null
          created_at: string | null
          current_stock: number | null
          group_code: string | null
          id: string
          period_quantities: Json
          period_revenues: Json
          run_id: string
          total_quantity: number | null
          total_revenue: number | null
          user_id: string
        }
        Insert: {
          article: string
          avg_price?: number | null
          category?: string | null
          created_at?: string | null
          current_stock?: number | null
          group_code?: string | null
          id?: string
          period_quantities?: Json
          period_revenues?: Json
          run_id: string
          total_quantity?: number | null
          total_revenue?: number | null
          user_id: string
        }
        Update: {
          article?: string
          avg_price?: number | null
          category?: string | null
          created_at?: string | null
          current_stock?: number | null
          group_code?: string | null
          id?: string
          period_quantities?: Json
          period_revenues?: Json
          run_id?: string
          total_quantity?: number | null
          total_revenue?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_data_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_data_raw: {
        Row: {
          article: string
          category: string | null
          chunk_index: number
          created_at: string | null
          id: string
          period: string
          price: number | null
          product_group: string | null
          quantity: number | null
          revenue: number | null
          run_id: string
          stock: number | null
        }
        Insert: {
          article: string
          category?: string | null
          chunk_index?: number
          created_at?: string | null
          id?: string
          period: string
          price?: number | null
          product_group?: string | null
          quantity?: number | null
          revenue?: number | null
          run_id: string
          stock?: number | null
        }
        Update: {
          article?: string
          category?: string | null
          chunk_index?: number
          created_at?: string | null
          id?: string
          period?: string
          price?: number | null
          product_group?: string | null
          quantity?: number | null
          revenue?: number | null
          run_id?: string
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_data_raw_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      run_mode: "1C_RAW" | "RAW" | "PROCESSED"
      run_status: "QUEUED" | "PROCESSING" | "DONE" | "ERROR"
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
      run_mode: ["1C_RAW", "RAW", "PROCESSED"],
      run_status: ["QUEUED", "PROCESSING", "DONE", "ERROR"],
    },
  },
} as const
