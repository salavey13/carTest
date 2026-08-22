# Franchize availability flow (`public.cars` + `public.rentals`)

## Scope
This document describes how market availability is computed for franchize catalog items in `app/franchize/actions.ts`.

## Data sources
1. `public.cars.availability_rules` (`jsonb`) — **base availability policy**.
2. `public.rentals` — **runtime occupancy** (active/confirmed/pending rentals).

## Market type scope
Market catalog intentionally loads these car types only:
- `bike`
- `accessories`
- `gear`
- `wbitem`

`ebike` is intentionally excluded from franchize market and used by configurator flows.

## Resolution order (highest priority first)
1. **Runtime rentals (`public.rentals`)**
   - statuses considered: `pending_confirmation`, `confirmed`, `active`
   - if rental is active now (or status is `active`) => status `busy`
   - if future booking exists (`pending_confirmation`/`confirmed`) => status `busy`

2. **Base rules (`cars.availability_rules`)**
   - `manual_status = busy|unavailable` => status `busy`
   - `type = weekends_only` and today is weekday => status `busy`

3. **Fallback**
   - otherwise vehicle is `available`

## Labels
- Active rental: `В аренде сейчас` / `В аренде до <date>`
- Upcoming booking: `Забронирован` / `Забронирован с <date>`
- Manual/rule-based blocking: `Временно занят` / `Временно недоступен` / `Доступен только по выходным`
- Default: `Свободен сегодня`

## Initialization helper
`markCrewBikesAvailable(slug)` helper sets `manual_status = "available"` in `availability_rules` for `bike` + `ebike` rows of a crew.

It is intended for initial bootstrap/reset and does not override runtime rental occupancy.
