-- Атомарное обновление Кибер-Фитнеса и Ghost Vibes
CREATE OR REPLACE FUNCTION update_user_cyber_stats(
  p_user_id TEXT,
  p_kv_delta FLOAT DEFAULT 0,
  p_gv_delta FLOAT DEFAULT 0,
  p_new_achievement TEXT DEFAULT NULL,
  p_feature_key TEXT DEFAULT NULL,
  p_feature_val JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_meta JSONB;
BEGIN
  -- Получаем текущие метаданные с блокировкой строки
  SELECT metadata FROM public.users WHERE user_id = p_user_id FOR UPDATE INTO v_meta;
  
  -- Инициализируем структуру, если её нет
  IF v_meta IS NULL THEN v_meta := '{}'::jsonb; END IF;
  IF v_meta->'cyberFitness' IS NULL THEN v_meta := jsonb_set(v_meta, '{cyberFitness}', '{"kiloVibes": 0, "achievements": [], "featuresUsed": {}, "ghost_stats": {"balance": 0}}'::jsonb); END IF;
  IF v_meta->'cyberFitness'->'ghost_stats' IS NULL THEN v_meta := jsonb_set(v_meta, '{cyberFitness, ghost_stats}', '{"balance": 0}'::jsonb); END IF;

  -- 1. Обновляем KiloVibes
  v_meta := jsonb_set(v_meta, '{cyberFitness, kiloVibes}', 
    (COALESCE((v_meta->'cyberFitness'->>'kiloVibes')::float, 0) + p_kv_delta)::text::jsonb);

  -- 2. Обновляем Ghost Vibes (Твой новый счетчик)
  v_meta := jsonb_set(v_meta, '{cyberFitness, ghost_stats, balance}', 
    (COALESCE((v_meta->'cyberFitness'->'ghost_stats'->>'balance')::float, 0) + p_gv_delta)::text::jsonb);

  -- 3. Добавляем ачивку, если она новая
  IF p_new_achievement IS NOT NULL AND NOT (v_meta->'cyberFitness'->'achievements' @> jsonb_build_array(p_new_achievement)) THEN
    v_meta := jsonb_set(v_meta, '{cyberFitness, achievements}', (v_meta->'cyberFitness'->'achievements') || jsonb_build_array(p_new_achievement));
  END IF;

  -- 4. Обновляем featuresUsed
  IF p_feature_key IS NOT NULL THEN
    v_meta := jsonb_set(v_meta, ARRAY['cyberFitness', 'featuresUsed', p_feature_key], p_feature_val);
  END IF;

  -- Сохраняем
  UPDATE public.users SET metadata = v_meta, updated_at = now() WHERE user_id = p_user_id;
  
  RETURN v_meta;
END;
$$ LANGUAGE plpgsql;