/**
 * Generated Supabase types — replaces the loose placeholder that shipped
 * before this project had a linkable schema (see docs/ROADMAP.md NK-03).
 *
 * Generated 2026-08-24 via:
 *
 *   supabase gen types typescript --local
 *
 * against a local Docker Postgres instance built purely by replaying
 * supabase/migrations/*.sql in order (`supabase init && supabase start`) —
 * not against the hosted project, since generating this required no
 * `supabase login`/access token this way. Because the local instance's
 * schema comes only from the committed migrations, this file is exactly
 * as accurate as those migrations are — if the hosted project's live
 * schema has ever drifted from them (a manual change made directly in the
 * Supabase dashboard, say), this won't reflect that drift. Regenerate
 * against the real project once linked (`supabase link` + `supabase gen
 * types typescript --linked`, or `--project-id <id>`) to close that gap,
 * and after every new migration either way.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          completion_tokens: number | null
          created_at: string
          id: string
          model: string
          prompt_tokens: number | null
          route: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          id?: string
          model: string
          prompt_tokens?: number | null
          route: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          id?: string
          model?: string
          prompt_tokens?: number | null
          route?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      device_sync_sessions: {
        Row: {
          created_at: string
          encrypted_dek: string | null
          encrypted_dek_iv: string | null
          expires_at: string
          pairing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_dek?: string | null
          encrypted_dek_iv?: string | null
          expires_at: string
          pairing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_dek?: string | null
          encrypted_dek_iv?: string | null
          expires_at?: string
          pairing_id?: string
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          created_at: string
          encrypted_content: string
          id: string
          iv: string
          mood_score: number | null
          tags: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_content: string
          id?: string
          iv: string
          mood_score?: number | null
          tags?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_content?: string
          id?: string
          iv?: string
          mood_score?: number | null
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      journal_keys: {
        Row: {
          created_at: string
          kdf_params: Json
          user_id: string
          wrapped_dek: string
          wrapped_dek_iv: string
          wrapped_dek_recovery: string
          wrapped_dek_recovery_iv: string
          wrapped_dek_recovery_salt: string
          wrapped_dek_salt: string
        }
        Insert: {
          created_at?: string
          kdf_params?: Json
          user_id: string
          wrapped_dek: string
          wrapped_dek_iv: string
          wrapped_dek_recovery: string
          wrapped_dek_recovery_iv: string
          wrapped_dek_recovery_salt: string
          wrapped_dek_salt: string
        }
        Update: {
          created_at?: string
          kdf_params?: Json
          user_id?: string
          wrapped_dek?: string
          wrapped_dek_iv?: string
          wrapped_dek_recovery?: string
          wrapped_dek_recovery_iv?: string
          wrapped_dek_recovery_salt?: string
          wrapped_dek_salt?: string
        }
        Relationships: []
      }
      manifestation_signals: {
        Row: {
          confidence: number
          detected_at: string
          entry_id: string
          id: string
          manifestation_id: string
          user_id: string
        }
        Insert: {
          confidence: number
          detected_at?: string
          entry_id: string
          id?: string
          manifestation_id: string
          user_id: string
        }
        Update: {
          confidence?: number
          detected_at?: string
          entry_id?: string
          id?: string
          manifestation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifestation_signals_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifestation_signals_manifestation_id_fkey"
            columns: ["manifestation_id"]
            isOneToOne: false
            referencedRelation: "manifestations"
            referencedColumns: ["id"]
          },
        ]
      }
      manifestations: {
        Row: {
          auto_detect: boolean
          cadence: string
          category: string | null
          created_at: string
          encrypted_text: string
          id: string
          iv: string
          status: string
          user_id: string
        }
        Insert: {
          auto_detect?: boolean
          cadence?: string
          category?: string | null
          created_at?: string
          encrypted_text: string
          id?: string
          iv: string
          status?: string
          user_id: string
        }
        Update: {
          auto_detect?: boolean
          cadence?: string
          category?: string | null
          created_at?: string
          encrypted_text?: string
          id?: string
          iv?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          daily_prompt_enabled: boolean
          daily_prompt_time: string
          manifestation_enabled: boolean
          playback_ready_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_prompt_enabled?: boolean
          daily_prompt_time?: string
          manifestation_enabled?: boolean
          playback_ready_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_prompt_enabled?: boolean
          daily_prompt_time?: string
          manifestation_enabled?: boolean
          playback_ready_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_cache: {
        Row: {
          cache_date: string
          created_at: string
          prompt: string
          template_version: number
          tone: string
        }
        Insert: {
          cache_date: string
          created_at?: string
          prompt: string
          template_version?: number
          tone: string
        }
        Update: {
          cache_date?: string
          created_at?: string
          prompt?: string
          template_version?: number
          tone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      requesting_user_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
