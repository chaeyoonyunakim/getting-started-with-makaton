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
      bandit_arms: {
        Row: {
          alpha: number
          beta: number
          card_id: string
          scene_id: string
          updated_at: string
        }
        Insert: {
          alpha?: number
          beta?: number
          card_id: string
          scene_id: string
          updated_at?: string
        }
        Update: {
          alpha?: number
          beta?: number
          card_id?: string
          scene_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bandit_arms_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bandit_arms_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      card_modifiers: {
        Row: {
          card_id: string
          created_at: string
          id: string
          label: string
          modifier_key: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          label: string
          modifier_key: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          label?: string
          modifier_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_modifiers_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_selections: {
        Row: {
          created_at: string
          dwell_ms: number | null
          from_card_id: string | null
          id: string
          predicted_in_top3: boolean
          pupil_id: string
          scene_id: string
          session_id: string
          to_card_id: string
        }
        Insert: {
          created_at?: string
          dwell_ms?: number | null
          from_card_id?: string | null
          id?: string
          predicted_in_top3?: boolean
          pupil_id: string
          scene_id: string
          session_id: string
          to_card_id: string
        }
        Update: {
          created_at?: string
          dwell_ms?: number | null
          from_card_id?: string | null
          id?: string
          predicted_in_top3?: boolean
          pupil_id?: string
          scene_id?: string
          session_id?: string
          to_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_selections_from_card_id_fkey"
            columns: ["from_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "pupils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_to_card_id_fkey"
            columns: ["to_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          attribution: string
          category_key: string | null
          created_at: string
          id: string
          key: string
          label: string
          licence: string
          makaton_stage: number | null
          source: string
          symbol_url: string | null
        }
        Insert: {
          attribution: string
          category_key?: string | null
          created_at?: string
          id?: string
          key: string
          label: string
          licence: string
          makaton_stage?: number | null
          source: string
          symbol_url?: string | null
        }
        Update: {
          attribution?: string
          category_key?: string | null
          created_at?: string
          id?: string
          key?: string
          label?: string
          licence?: string
          makaton_stage?: number | null
          source?: string
          symbol_url?: string | null
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          org_id: string
          retention_days: number
          reward_min_distinct_scenes: number
          reward_min_selections: number
          updated_at: string
        }
        Insert: {
          org_id: string
          retention_days?: number
          reward_min_distinct_scenes?: number
          reward_min_selections?: number
          updated_at?: string
        }
        Update: {
          org_id?: string
          retention_days?: number
          reward_min_distinct_scenes?: number
          reward_min_selections?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_symbol_packs: {
        Row: {
          attribution: string
          created_at: string
          id: string
          image_url: string
          label: string
          org_id: string
        }
        Insert: {
          attribution?: string
          created_at?: string
          id?: string
          image_url: string
          label: string
          org_id: string
        }
        Update: {
          attribution?: string
          created_at?: string
          id?: string
          image_url?: string
          label?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_symbol_packs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      predictions_log: {
        Row: {
          chosen_id: string | null
          current_card_id: string | null
          prediction_id: string
          pupil_id: string
          scene_id: string
          session_id: string
          top3: Json
          ts: string
        }
        Insert: {
          chosen_id?: string | null
          current_card_id?: string | null
          prediction_id?: string
          pupil_id: string
          scene_id: string
          session_id: string
          top3: Json
          ts?: string
        }
        Update: {
          chosen_id?: string | null
          current_card_id?: string | null
          prediction_id?: string
          pupil_id?: string
          scene_id?: string
          session_id?: string
          top3?: Json
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_log_chosen_id_fkey"
            columns: ["chosen_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_log_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_log_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "pupils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_log_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      pupil_scene_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          pupil_id: string
          scene_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          pupil_id: string
          scene_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          pupil_id?: string
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pupil_scene_overrides_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "pupils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pupil_scene_overrides_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      pupils: {
        Row: {
          created_at: string
          depth_setting: number
          display_name: string
          ehcp_categories: string[] | null
          grid_size: number
          home_language: string | null
          id: string
          makaton_licensed: boolean
          makaton_stage: number | null
          org_id: string
          year_group: number | null
        }
        Insert: {
          created_at?: string
          depth_setting?: number
          display_name: string
          ehcp_categories?: string[] | null
          grid_size?: number
          home_language?: string | null
          id?: string
          makaton_licensed?: boolean
          makaton_stage?: number | null
          org_id: string
          year_group?: number | null
        }
        Update: {
          created_at?: string
          depth_setting?: number
          display_name?: string
          ehcp_categories?: string[] | null
          grid_size?: number
          home_language?: string | null
          id?: string
          makaton_licensed?: boolean
          makaton_stage?: number | null
          org_id?: string
          year_group?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pupils_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_cards: {
        Row: {
          card_id: string
          created_at: string
          position: number
          scene_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          position: number
          scene_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          position?: number
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_cards_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          key: string
          label: string
          org_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          key: string
          label: string
          org_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          key?: string
          label?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "scenes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          depth_used: number | null
          ended_at: string | null
          golden_sign_awarded: boolean
          id: string
          pupil_id: string
          scene_count: number
          started_at: string
          ta_id: string | null
          total_selections: number
        }
        Insert: {
          depth_used?: number | null
          ended_at?: string | null
          golden_sign_awarded?: boolean
          id?: string
          pupil_id: string
          scene_count?: number
          started_at?: string
          ta_id?: string | null
          total_selections?: number
        }
        Update: {
          depth_used?: number | null
          ended_at?: string | null
          golden_sign_awarded?: boolean
          id?: string
          pupil_id?: string
          scene_count?: number
          started_at?: string
          ta_id?: string | null
          total_selections?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "pupils"
            referencedColumns: ["id"]
          },
        ]
      }
      symbol_review_queue: {
        Row: {
          candidate_url: string
          created_at: string
          id: string
          label: string
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_name: string | null
          source: string
          state: string
        }
        Insert: {
          candidate_url: string
          created_at?: string
          id?: string
          label: string
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_name?: string | null
          source?: string
          state?: string
        }
        Update: {
          candidate_url?: string
          created_at?: string
          id?: string
          label?: string
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_name?: string | null
          source?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbol_review_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ta_notifications: {
        Row: {
          acknowledged_at: string | null
          child_name: string
          created_at: string
          id: string
          org_id: string
          pupil_id: string | null
          rationale: string | null
          selection: string
          session_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          child_name: string
          created_at?: string
          id?: string
          org_id: string
          pupil_id?: string | null
          rationale?: string | null
          selection: string
          session_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          child_name?: string
          created_at?: string
          id?: string
          org_id?: string
          pupil_id?: string | null
          rationale?: string | null
          selection?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ta_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ta_notifications_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "pupils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ta_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_pupil_transitions: {
        Row: {
          count: number | null
          from_card_id: string | null
          last_seen_at: string | null
          pupil_id: string | null
          scene_id: string | null
          to_card_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_selections_from_card_id_fkey"
            columns: ["from_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "pupils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_selections_to_card_id_fkey"
            columns: ["to_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_org: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ta" | "senco"
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
      app_role: ["ta", "senco"],
    },
  },
} as const
