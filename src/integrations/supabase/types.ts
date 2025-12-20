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
          progress_message: string | null
          progress_percent: number | null
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
          progress_message?: string | null
          progress_percent?: number | null
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
          progress_message?: string | null
          progress_percent?: number | null
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
          size: string | null
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
          size?: string | null
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
          size?: string | null
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
          size: string | null
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
          size?: string | null
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
          size?: string | null
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
      unit_econ_inputs: {
        Row: {
          acceptance_rub: number | null
          accessories_cost: number | null
          admin_overhead_pct: number | null
          approved_discount_pct: number | null
          article: string
          buyer_price_with_spp: number | null
          calculation_date: string | null
          category: string | null
          competitor_price: number | null
          competitor_url: string | null
          created_at: string | null
          cutting_cost: number | null
          delivery_rub: number | null
          fabric_cost_total: number | null
          fabric1_cost_rub_per_unit: number | null
          fabric1_kg_per_unit: number | null
          fabric1_name: string | null
          fabric1_price_rub_per_kg: number | null
          fabric1_price_usd: number | null
          fabric1_weight_cut_kg: number | null
          fabric2_cost_rub_per_unit: number | null
          fabric2_kg_per_unit: number | null
          fabric2_name: string | null
          fabric2_price_rub_per_kg: number | null
          fabric2_price_usd: number | null
          fabric2_weight_cut_kg: number | null
          fabric3_cost_rub_per_unit: number | null
          fabric3_kg_per_unit: number | null
          fabric3_name: string | null
          fabric3_price_rub_per_kg: number | null
          fabric3_price_usd: number | null
          fabric3_weight_cut_kg: number | null
          fx_rate: number | null
          id: string
          investments_rub: number | null
          is_new: boolean | null
          name: string | null
          non_purchase_pct: number | null
          planned_retail_after_discount: number | null
          planned_sales_month_qty: number | null
          print_embroidery_cost: number | null
          product_url: string | null
          retail_before_discount: number | null
          retail_price_rub: number | null
          scenario_desired_price: number | null
          scenario_min_price: number | null
          scenario_min_profit: number | null
          scenario_plan_price: number | null
          scenario_plan_profit: number | null
          scenario_recommended_price: number | null
          sewing_cost: number | null
          spp_pct: number | null
          unit_cost_real_rub: number | null
          units_in_cut: number | null
          updated_at: string | null
          user_id: string
          usn_tax_pct: number | null
          wb_commission_pct: number | null
          wholesale_markup_pct: number | null
          wholesale_price_rub: number | null
        }
        Insert: {
          acceptance_rub?: number | null
          accessories_cost?: number | null
          admin_overhead_pct?: number | null
          approved_discount_pct?: number | null
          article: string
          buyer_price_with_spp?: number | null
          calculation_date?: string | null
          category?: string | null
          competitor_price?: number | null
          competitor_url?: string | null
          created_at?: string | null
          cutting_cost?: number | null
          delivery_rub?: number | null
          fabric_cost_total?: number | null
          fabric1_cost_rub_per_unit?: number | null
          fabric1_kg_per_unit?: number | null
          fabric1_name?: string | null
          fabric1_price_rub_per_kg?: number | null
          fabric1_price_usd?: number | null
          fabric1_weight_cut_kg?: number | null
          fabric2_cost_rub_per_unit?: number | null
          fabric2_kg_per_unit?: number | null
          fabric2_name?: string | null
          fabric2_price_rub_per_kg?: number | null
          fabric2_price_usd?: number | null
          fabric2_weight_cut_kg?: number | null
          fabric3_cost_rub_per_unit?: number | null
          fabric3_kg_per_unit?: number | null
          fabric3_name?: string | null
          fabric3_price_rub_per_kg?: number | null
          fabric3_price_usd?: number | null
          fabric3_weight_cut_kg?: number | null
          fx_rate?: number | null
          id?: string
          investments_rub?: number | null
          is_new?: boolean | null
          name?: string | null
          non_purchase_pct?: number | null
          planned_retail_after_discount?: number | null
          planned_sales_month_qty?: number | null
          print_embroidery_cost?: number | null
          product_url?: string | null
          retail_before_discount?: number | null
          retail_price_rub?: number | null
          scenario_desired_price?: number | null
          scenario_min_price?: number | null
          scenario_min_profit?: number | null
          scenario_plan_price?: number | null
          scenario_plan_profit?: number | null
          scenario_recommended_price?: number | null
          sewing_cost?: number | null
          spp_pct?: number | null
          unit_cost_real_rub?: number | null
          units_in_cut?: number | null
          updated_at?: string | null
          user_id: string
          usn_tax_pct?: number | null
          wb_commission_pct?: number | null
          wholesale_markup_pct?: number | null
          wholesale_price_rub?: number | null
        }
        Update: {
          acceptance_rub?: number | null
          accessories_cost?: number | null
          admin_overhead_pct?: number | null
          approved_discount_pct?: number | null
          article?: string
          buyer_price_with_spp?: number | null
          calculation_date?: string | null
          category?: string | null
          competitor_price?: number | null
          competitor_url?: string | null
          created_at?: string | null
          cutting_cost?: number | null
          delivery_rub?: number | null
          fabric_cost_total?: number | null
          fabric1_cost_rub_per_unit?: number | null
          fabric1_kg_per_unit?: number | null
          fabric1_name?: string | null
          fabric1_price_rub_per_kg?: number | null
          fabric1_price_usd?: number | null
          fabric1_weight_cut_kg?: number | null
          fabric2_cost_rub_per_unit?: number | null
          fabric2_kg_per_unit?: number | null
          fabric2_name?: string | null
          fabric2_price_rub_per_kg?: number | null
          fabric2_price_usd?: number | null
          fabric2_weight_cut_kg?: number | null
          fabric3_cost_rub_per_unit?: number | null
          fabric3_kg_per_unit?: number | null
          fabric3_name?: string | null
          fabric3_price_rub_per_kg?: number | null
          fabric3_price_usd?: number | null
          fabric3_weight_cut_kg?: number | null
          fx_rate?: number | null
          id?: string
          investments_rub?: number | null
          is_new?: boolean | null
          name?: string | null
          non_purchase_pct?: number | null
          planned_retail_after_discount?: number | null
          planned_sales_month_qty?: number | null
          print_embroidery_cost?: number | null
          product_url?: string | null
          retail_before_discount?: number | null
          retail_price_rub?: number | null
          scenario_desired_price?: number | null
          scenario_min_price?: number | null
          scenario_min_profit?: number | null
          scenario_plan_price?: number | null
          scenario_plan_profit?: number | null
          scenario_recommended_price?: number | null
          sewing_cost?: number | null
          spp_pct?: number | null
          unit_cost_real_rub?: number | null
          units_in_cut?: number | null
          updated_at?: string | null
          user_id?: string
          usn_tax_pct?: number | null
          wb_commission_pct?: number | null
          wholesale_markup_pct?: number | null
          wholesale_price_rub?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analytics_phase1_aggregate: {
        Args: { p_run_id: string }
        Returns: number
      }
      analytics_phase1_batch: {
        Args: { p_limit: number; p_offset: number; p_run_id: string }
        Returns: number
      }
      analytics_phase2_xyz: { Args: { p_run_id: string }; Returns: undefined }
      analytics_phase2_xyz_batch: {
        Args: { p_limit: number; p_offset: number; p_run_id: string }
        Returns: number
      }
      analytics_phase2_xyz_batched: {
        Args: { p_run_id: string }
        Returns: undefined
      }
      analytics_phase3_abc: { Args: { p_run_id: string }; Returns: undefined }
      analytics_phase4_plans: { Args: { p_run_id: string }; Returns: undefined }
      append_run_log: {
        Args: {
          p_context?: Json
          p_level: string
          p_message: string
          p_run_id: string
          p_step: string
        }
        Returns: undefined
      }
      get_run_periods: {
        Args: { p_run_id: string }
        Returns: {
          period: string
        }[]
      }
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
