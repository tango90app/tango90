-- ================================================================
-- Tango90 — Migration 001: crear tabla plaques
-- Ejecutar en: Supabase > SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS plaques (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  anon_id    text        NOT NULL,
  match_id   text        NOT NULL,
  type       text        NOT NULL CHECK (type IN ('team', 'match')),
  team_id    text,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Consistencia de team_id según tipo:
  --   type='team'  → team_id obligatorio (NOT NULL)
  --   type='match' → team_id prohibido (debe ser NULL)
  CONSTRAINT plaques_team_id_consistency CHECK (
    (type = 'team'  AND team_id IS NOT NULL) OR
    (type = 'match' AND team_id IS NULL)
  )
);

-- Una sola placa por tipo por usuario+partido.
-- La clave NO incluye team_id:
--   → solo puede existir UN registro type='team' por usuario+partido (primer equipo completado)
--   → solo puede existir UN registro type='match' por usuario+partido
CREATE UNIQUE INDEX IF NOT EXISTS idx_plaques_unique
  ON plaques (anon_id, match_id, type);

-- Índice de lookup eficiente (usado en GET progress y POST votes)
CREATE INDEX IF NOT EXISTS idx_plaques_lookup
  ON plaques (anon_id, match_id);

-- RLS: solo el service role (server-side API) puede leer/escribir.
-- El frontend nunca accede directamente a esta tabla.
ALTER TABLE plaques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plaques_no_direct_client_access"
  ON plaques FOR ALL
  USING (false);
