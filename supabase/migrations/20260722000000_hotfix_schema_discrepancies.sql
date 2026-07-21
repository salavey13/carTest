-- =============================================================================
-- Migration: 20260722000000_hotfix_schema_discrepancies
-- Purpose:   Backfill rental verification todos into crew_todos
-- Fix:       v_crew_id was NULL for rentals without an explicit crew_id.
--            Now resolves crew_id via COALESCE(rental.crew_id, car.crew_id)
--            and skips unassignable rentals instead of crashing on NOT NULL.
-- =============================================================================

DO $$
DECLARE
  v_rental RECORD;
  v_crew_id text;  -- crew_todos.crew_id is text; crews.id is uuid
  v_lead_id text;
  v_todo_type text;
  v_todo_title text;
BEGIN
  -- Iterate over rentals that can be mapped to a crew (directly or via car)
  FOR v_rental IN
    SELECT
      r.rental_id,
      r.user_id,
      r.vehicle_id,
      r.owner_id,
      r.status,
      r.agreed_end_date,
      r.metadata,
      r.created_by_operator_chat_id,
      -- Fallback chain: rental.crew_id → car.crew_id → skip
      COALESCE(r.crew_id::text, c.crew_id::text) AS resolved_crew_id
    FROM public.rentals r
    LEFT JOIN public.cars c ON c.id = r.vehicle_id
    WHERE r.status IN ('pending_confirmation', 'confirmed', 'active', 'completed')
      AND COALESCE(r.crew_id, c.crew_id) IS NOT NULL
    ORDER BY r.created_at
  LOOP
    v_crew_id := v_rental.resolved_crew_id;
    v_lead_id := COALESCE(
      v_rental.user_id,
      v_rental.created_by_operator_chat_id,
      v_rental.owner_id
    );

    -- Spawn a todo for each verification document type
    FOREACH v_todo_type IN ARRAY ARRAY[
      'passport_mainpage',
      'passport_registration',
      'drivers_license'
    ]
    LOOP
      v_todo_title := CASE v_todo_type
        WHEN 'passport_mainpage'
          THEN 'Верифицировать паспорт (главная страница)'
        WHEN 'passport_registration'
          THEN 'Верифицировать паспорт (регистрация)'
        WHEN 'drivers_license'
          THEN 'Верифицировать водительское удостоверение'
      END;

      INSERT INTO public.crew_todos (
        id,
        crew_id,
        lead_id,
        user_id,
        rental_id,
        title,
        description,
        category,
        status,
        priority,
        assigned_to,
        created_by,
        due_date
      ) VALUES (
        'todo-verification-' || v_rental.rental_id::text || '-' || v_todo_type,
        v_crew_id,
        v_lead_id,
        CASE
          WHEN v_lead_id ~ '^\d{1,12}$' THEN v_lead_id
          ELSE NULL
        END,
        v_rental.rental_id,
        v_todo_title,
        jsonb_build_object(
          'rental_id', v_rental.rental_id::text,
          'todo_type', v_todo_type,
          'source', 'rental_verification_backfill',
          'lead_id', v_lead_id
        ),
        'rental_verification',
        CASE
          WHEN v_rental.status = 'completed' THEN 'done'
          ELSE 'pending'
        END,
        'high',
        v_rental.metadata->>'created_by_operator_chat_id',
        'system',
        v_rental.agreed_end_date
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
