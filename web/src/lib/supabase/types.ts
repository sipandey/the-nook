/**
 * Placeholder for generated Supabase types.
 *
 * Once the project is linked, replace this file's contents with the real
 * output of:
 *
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 *
 * Typed loosely (not `Record<string, never>`) so query builders don't reject
 * every column/table name before the real schema exists — this trades away
 * compile-time column checking until the generated types land.
 */

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      journal_keys: LooseTable;
      entries: LooseTable;
      manifestations: LooseTable;
      manifestation_signals: LooseTable;
      notification_prefs: LooseTable;
      device_sync_sessions: LooseTable;
      prompt_cache: LooseTable;
      ai_usage_log: LooseTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
