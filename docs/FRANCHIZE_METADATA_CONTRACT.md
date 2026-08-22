# Franchize metadata contract

Status: `frozen`  
Task: `FRZ-R1` (`d6088cf8-46e1-4637-98bc-9f9a334ce3ed`)  
Updated: `2026-03-20`

## Frozen metadata contract (FRZ-R1)

This contract locks the minimum metadata shape used by `/franchize/[slug]` runtime and checkout-adjacent UI.

Required top-level block:

- `metadata.franchize` (preferred) or `metadata` (legacy fallback source).

Expected stable blocks:

1. `branding`
   - `name: string`
   - `tagline: string`
   - `logoUrl: string`
2. `theme`
   - `mode: string`
   - `palette.bgBase: string`
   - `palette.bgCard: string`
   - `palette.accentMain: string`
   - `palette.accentMainHover: string`
   - `palette.textPrimary: string`
   - `palette.textSecondary: string`
   - `palette.borderSoft: string`
3. `header`
   - `logoHref?: string` (optional; if present, header logo redirects to this path, e.g. `/vipbikerental`)
   - `menuLinks: Array<{ label: string; href: string }>`
4. `contacts`
   - `phone, email, address, telegram, workingHours: string`
   - `map.gps, map.publicTransport, map.carDirections, map.imageUrl: string`
   - `map.bounds.top|bottom|left|right: number-like`
5. `catalog`
   - `groupOrder: string[]`
   - `quickLinks: string[]`
   - `tickerItems, promoBanners, adCards, showcaseGroups`
6. `footer`
   - `socialLinks: Array<{ label: string; href: string }>`
   - `textColor: string`

## Fallback matrix

| Contract field | Primary source | Fallback chain |
|---|---|---|
| Theme palette | `theme.palette` or mode bucket (`theme.palette.light/dark`, `theme.palettes.light/dark`) | Pepperolli default palette in `app/franchize/actions.ts` |
| Header menu | `header.menuLinks` | generated slug-aware defaults (`/franchize/{slug}`, `/about`, `/contacts`, `/cart`) |
| Header logo click target | `header.logoHref` | `/franchize/{slug}` |
| Contacts phone/email/address | `contacts.*` | `footer.*` -> crew DB fields (`hq_location`) |
| Footer social links | `footer.socialLinks` | `footer.columns[].items[]` -> `contacts.telegram` -> `oneBikePlsBot` |
| Catalog order | `catalog.groupOrder` | derive from catalog item subtype frequency |
| Slug-aware links | explicit `{slug}` links | route compatibility mapping via `withSlug()` |

## Compatibility guarantee

FRZ-R2 (`franchize.telegram`) and FRZ-R3 (`franchize.analytics`) must treat this document as input contract v1.

- New fields can be added only as backward-compatible optional keys.
- Existing fallback order cannot be changed without updating:
  1. this contract file;
  2. `docs/THE_FRANCHEEZEPLAN.md`;
  3. downstream SupaPlan task notes for affected lanes.

If a lane needs a breaking contract change, create a new blocking task before parallel execution resumes.
