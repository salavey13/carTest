-- Включаем RLS
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- Арендатор — свои сделки
CREATE POLICY "rentals_select_as_renter_chat_sub"
ON public.rentals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.chat_id::text = auth.sub()
      AND u.user_id = rentals.user_id
  )
);

-- Владелец сделки — свои
CREATE POLICY "rentals_select_as_owner_chat_sub"
ON public.rentals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.chat_id::text = auth.sub()
      AND u.user_id = rentals.owner_id
  )
);

-- Владелец экипажа — сделки по своим машинам
CREATE POLICY "rentals_select_as_crew_owner_chat_sub"
ON public.rentals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.cars c
    JOIN public.crews cr ON c.crew_id = cr.id
    JOIN public.users u ON cr.owner_id = u.user_id
    WHERE c.id = rentals.vehicle_id
      AND u.chat_id::text = auth.sub()
  )
);

-- cars
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cars_select_for_rentals_chat_sub"
ON public.cars
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.chat_id::text = auth.sub()
      AND (
        u.user_id = cars.owner_id
        OR u.user_id IN (
          SELECT cr.owner_id
          FROM public.crews cr
          WHERE cr.id = cars.crew_id
        )
      )
  )
);

-- crews
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crews_select_owner_chat_sub"
ON public.crews
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.chat_id::text = auth.sub()
      AND (
        u.user_id = crews.owner_id
        OR u.user_id IN (
          SELECT m.user_id
          FROM public.crew_members m
          WHERE m.crew_id = crews.id
            AND m.status = 'active'
        )
      )
  )
);

-- crew_members
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crew_members_select_self_chat_sub"
ON public.crew_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.chat_id::text = auth.sub()
      AND u.user_id = crew_members.user_id
  )
);