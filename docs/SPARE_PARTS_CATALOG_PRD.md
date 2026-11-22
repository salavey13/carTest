# PRD: Запчасти (Spare Parts) Catalog

> **Goal:** Create a spare parts catalog section for the franchize web app, similar to existing rent/sale/equipment catalogs.
> - Hardcoded initial data ( Surge-V spare parts from extracted CSV files)
> - Later: Admin-editable catalog with Supabase backend
> - DisplayMode: "parts" (new mode added to existing system)

---

## Current Baseline

### Existing Catalog Sections
1. **Rent/Sale Bikes** (`/franchize/{slug}/electro-enduro`) - `DisplayModeProvider` with `rent|sale|service|equipment`
2. **Equipment Catalog** (`/franchize/{slug}/equipment`) - locked mode `equipment`
3. **Shared Components:**
   - `CatalogClient` - main catalog component
   - `DisplayModeContext` - manages catalog mode state
   - `CrewHeader` - top navigation with category rail
   - `FranchizeCard` - individual item cards

### Existing Data Sources
- CSV files extracted from Surge-V Excel:
  - `docs/crewDocs/surge_parts_csv/Surge_Electric_Parts.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Wheel_Sets.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Saddle.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Braking_Chain_Sets.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Plastic_Parts.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Structural_Part.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Front_Rear_Suspension.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Rubber_Parts.csv`
  - `docs/crewDocs/surge_parts_csv/Surge_Standard_Parts.csv`
- Images: `public/supabase-mirror/parts-pics/{category}/`

---

## Target Layout

### Page Structure
```
┌─────────────────────────────────────────────────────┐
│ [CREW HEADER]     Запчасти                         │
│                  Категория: Мотоциклы               │
├─────────────────────────────────────────────────────┤
│ [CATEGORY RAIL]                                     │
│ • Electric parts • Wheel sets • Saddle            │
│ • Braking • Plastic • Structural                   │
│ • Suspension • Rubber • Standard                   │
├─────────────────────────────────────────────────────┤
│ [SEARCH BAR] 🔍 Поиск по названию или артикулу    │
├─────────────────────────────────────────────────────┤
│ [PARTS GRID]                                        │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐│
│ │ [IMG]         │ │ [IMG]         │ │ [IMG]         ││
│ │ Brake handle  │ │ Front brake   │ │ Disc pad      ││
│ │ (Left)        │ │               │ │               │││
│ │ 97040001      │ │ 97040002      │ │ 97040003      ││
│ │ 2 500 ₽       │ │ 3 200 ₽       │ │ 800 ₽         ││
│ └───────────────┘ └───────────────┘ └───────────────┘│
│ ... more parts ...                                  │
└─────────────────────────────────────────────────────┘
```

### Item Modal (Detail View)
```
┌─────────────────────────────────────────────────────┐
│ [BACK]          Brake handle (Left)                 │
│                  97040001                           │
├─────────────────────────────────────────────────────┤
│ [LARGE IMAGE]                                       │
├─────────────────────────────────────────────────────┤
│ Category:    Braking & chain sets                  │
│ Price:       2 500 ₽                               │
│ Stock:       В наличии (5 шт)                      │
│ Description: Левая ручка тормоза, универсальная     │
├─────────────────────────────────────────────────────┤
│ [📞 Добавить в заявку]  [📋 Характеристики]        │
└─────────────────────────────────────────────────────┘
```

---

## Technical Design

### Phase 1: Hardcoded Implementation (itBD)

#### 1.1 File Structure
```
app/franchize/[slug]/parts/page.tsx              # New page
app/franchize/components/PartsCatalogClient.tsx   # New component
app/franchize/lib/parts-data.ts                  # Hardcoded data parser
docs/crewDocs/surge_parts_csv/*.csv               # Data source
public/supabase-mirror/parts-pics/*/              # Images
```

#### 1.2 Data Model (TypeScript)
```typescript
interface SparePart {
  id: string;           // e.g., "97040001"
  name: string;         // e.g., "Brake handle (Left)"
  category: string;     // e.g., "Braking&chain sets"
  price: number;        // e.g., 2500
  image?: string;       // relative path to image
  stock?: number;       // quantity in stock
  description?: string; // optional description
}

interface PartsCategory {
  id: string;           // e.g., "braking-chain"
  name: string;         // e.g., "Braking & chain sets"
  parts: SparePart[];
}
```

#### 1.3 CSV Parser (`lib/parts-data.ts`)
```typescript
import fs from 'fs';
import path from 'path';

const CSV_FILES = [
  'Surge_Electric_Parts.csv',
  'Surge_Wheel_Sets.csv',
  'Surge_Saddle.csv',
  'Surge_Braking_Chain_Sets.csv',
  'Surge_Plastic_Parts.csv',
  'Surge_Structural_Part.csv',
  'Surge_Front_Rear_Suspension.csv',
  'Surge_Rubber_Parts.csv',
  'Surge_Standard_Parts.csv',
];

export function loadPartsData(): PartsCategory[] {
  // Parse CSV files and return structured data
  // Map CSV columns to SparePart interface
  // Group by category
}
```

#### 1.4 DisplayMode Extension
Update `DisplayModeContext.tsx`:
```typescript
type DisplayMode = "rent" | "sale" | "service" | "equipment" | "parts";
```

#### 1.5 Page Component (`parts/page.tsx`)
```typescript
export default async function PartsPage({ params }: EquipmentPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const parts = loadPartsData(); // Hardcoded data
  
  return (
    <main>
      <ThemeInitializer defaultTheme="dark" />
      <DisplayModeProvider lockMode="parts">
        <CrewHeader crew={crew} activePath={`/franchize/${slug}/parts`} />
        <PartsCatalogClient parts={parts} />
      </DisplayModeProvider>
    </main>
  );
}
```

---

### Phase 2: Admin-Editable Catalog (Future)

#### 2.1 Database Schema (Supabase)
```sql
-- Spare parts table
CREATE TABLE spare_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  part_number TEXT UNIQUE NOT NULL,  -- e.g., "97040001"
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE part_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);
```

#### 2.2 Admin Interface
- CRUD operations for parts
- Bulk import from CSV
- Image upload to Supabase Storage

---

## User Flow

### 1. Browse Parts
1. User opens `/franchize/{slug}/parts`
2. Sees category rail at top
3. Taps category → grid filters to that category
4. Taps part → detail modal opens

### 2. Search Parts
1. User types in search bar
2. Grid filters in real-time (name OR part_number)
3. Category rail shows "Все" + matching categories

### 3. Add to Request (Phase 2)
1. User taps "📞 Добавить в заявку"
2. Part added to request list (stored in localStorage)
3. Floating counter badge shows total items

---

## Implementation Tasks (itBD)

### Step 1: Data Preparation
- [x] Verify CSV files have correct structure
- [x] Extract all images to `public/supabase-mirror/parts-pics/{category}/` (145 images via `scripts/extract-parts-images-final.mjs`)
- [x] Create `lib/parts-data.ts` parser (multi-category aware, RU-first with EN fallback)
- [x] Russian translation of all sections → `docs/crewDocs/surge_parts_csv_ru/*.csv` (147 parts)
- [x] Concatenated master CSV → `docs/crewDocs/surge_parts_all_ru.csv` (via `scripts/concat-parts-csv-ru.mjs`)

### Step 2: DisplayMode Extension
- [x] Add "parts" to DisplayMode type
- [x] Update DisplayModeProvider to handle "parts" mode

### Step 3: Page & Components
- [x] Create `app/franchize/[slug]/parts/page.tsx`
- [x] Create `PartsCatalogClient.tsx` component (self-contained card grid + detail modal)

### Step 4: Navigation
- [x] Add "Запчасти" link to CrewHeader navigation (Wrench icon, routes to `/parts`)

### Step 5: Polish
- [x] Search functionality (name + part number)
- [x] Category filtering (rail with counts)
- [x] Responsive grid (2 columns mobile, 3 tablet, 4 desktop)
- [x] Pricing formula ×2.5 applied on load; price 0 → "Цена по запросу"
- [x] Contacts update: Комсомольская площадь pickup note + Telegram order CTA (no fake phone)
- [x] "Мотарды" added to Wheel sets (MOTARD-SET, price on request)
- [ ] Image lazy loading — partial: next/image default lazy; no custom intersection observer

---

## Future Enhancements (Phase 2+)

- **Admin Interface:** Add/edit parts via web UI
- **Supabase Backend:** Replace hardcoded CSV with DB queries
- **Request System:** "Add to request" → send to crew owner
- **Stock Management:** Track inventory, low stock alerts
- **Multi-Crew:** Shared parts across crews
- **Price History:** Track price changes over time

---

## Audio Message Requirements (from user's notes)

Based on the audio message, implement:

### 1. Translation & Localization
- Full Russian translation of catalog interface
- All UI text in Russian

### 2. Pricing
- Formula: `Final Price (₽) = Base Price × 2.5`
- Apply to all parts on load

### 3. Contact Information Update
- Remove old contacts (WyeVolt / Вайвольт)
- Add new contacts:
  - Address: Комсомольская площадь
  - Company phone number
  - Additional contact details

### 4. Catalog Enhancement
- Add "Мотарды" (Motards) to "Wheel sets" category

---

## Open Questions

1. Should parts be crew-specific or global?
2. Should we implement request system now or later?
3. Image naming convention: `{part_id}.png` or `{part_name}.png`?

---

*Created: 2026-08-23*
*Status: Phase 1 implemented (hardcoded CSV data, RU translations, ×2.5 pricing, images extracted)*
