# PRD: /ekip Command Enhancements — Advanced Equipment Selection

**Document Version:** 2.0  
**Date:** 2026-08-20  
**Status:** DRAFT — Ready for Implementation  
**Base Implementation:** `app/webhook-handlers/commands/ekip-manual.ts` (v1.0)

---

## Executive Summary

This PRD defines **five enhancements** to the `/ekip` equipment rental/selling command to improve the equipment selection UX with **subcategory filtering**, **photo previews**, **size selection**, **color/material variants**, and **admin photo uploads**.

**Current State:** The `/ekip command (v1.0) allows basic equipment selection by category only. Users select from a flat list grouped by `specs.category` (helmet, jacket, gloves, etc.).

**Target State:** Rich equipment selection with subcategory filtering, visual previews, variant selection (size/color/material), and complete photo coverage for all equipment items.

---

## Table of Contents

1. [Enhancement Overview](#1-enhancement-overview)
2. [B.1: Leather/Textile Subcategory Preselection](#b1-leathertextile-subcategory-preselection)
3. [B.2: Photo Preview for Selected Equipment](#b2-photo-preview-for-selected-equipment)
4. [B.3: Size Display & Selection](#b3-size-display--selection)
5. [B.4: Color/Material Variant Selection](#b4-colormaterial-variant-selection)
6. [B.5: Admin Equipment Photo Upload](#b5-admin-equipment-photo-upload)
7. [Implementation Strategy](#7-implementation-strategy)
8. [Testing Specifications](#8-testing-specifications)
9. [Success Metrics](#9-success-metrics)

---

## 1. Enhancement Overview

### 1.1 Feature Matrix

| Feature | Prefix/Key | Priority | Complexity | User Value |
|---------|------------|----------|------------|------------|
| B.1 Subcategory Preselection | `eksub_` | HIGH | Medium | Faster category navigation |
| B.2 Photo Preview | N/A | HIGH | Low | Visual confirmation |
| B.3 Size Selection | `specs.sizes` | HIGH | Medium | Correct fit selection |
| B.4 Color/Material Variants | `ekvar_` | MEDIUM | High | Variant-specific inventory |
| B.5 Admin Photo Upload | N/A | MEDIUM | Low | Complete catalog visuals |

### 1.2 User Flow Impact

**Before (v1.0):**
```
/ekip → [Flat equipment list by category] → Select item
```

**After (v2.0):**
```
/ekip → [Category selection] → [Subcategory filter] → 
[Items with photo previews] → [Size selection] → 
[Color/Material variant] → [Final selection with confirmation]
```

---

## 2. B.1: Leather/Textile Subcategory Preselection

### 2.1 Problem Statement

**Current Behavior:** When selecting a jacket or gloves, users see ALL items in that category (summer, winter, textile, leather, enduro, sport) in a single flat list. For crews with 20+ jackets, this creates overwhelming keyboards that exceed Telegram's row limits.

**User Impact:** Difficult to find specific equipment types, excessive scrolling, cognitive overload.

### 2.2 Solution Design

**State:** `equipment_subcategory`

**Callback Prefix:** `eksub_`

**Subcategory Schema:**

```typescript
interface EquipmentSubcategory {
  id: string;
  label: string;
  icon: string;
  category: string;
  filterKey: string;  //specs.subcategory to match
}

const EQUIPMENT_SUBCATEGORIES: EquipmentSubcategory[] = [
  // Jackets
  { id: 'jk_summer', label: 'Летние куртки', icon: '☀️', category: 'jacket', filterKey: 'summer' },
  { id: 'jk_winter', label: 'Зимние куртки', icon: '❄️', category: 'jacket', filterKey: 'winter' },
  { id: 'jk_textile', label: 'Текстиль', icon: '🧵', category: 'jacket', filterKey: 'textile' },
  { id: 'jk_leather', label: 'Кожа', icon: '🧥', category: 'jacket', filterKey: 'leather' },
  { id: 'jk_enduro', label: 'Эндуро', icon: '🏍️', category: 'jacket', filterKey: 'enduro' },
  
  // Gloves
  { id: 'gl_summer', label: 'Летние перчатки', icon: '☀️', category: 'gloves', filterKey: 'summer' },
  { id: 'gl_winter', label: 'Зимние перчатки', icon: '❄️', category: 'gloves', filterKey: 'winter' },
  { id: 'gl_street', label: 'Городские', icon: '🏙️', category: 'gloves', filterKey: 'street' },
  { id: 'gl_enduro', label: 'Эндуро', icon: '🏍️', category: 'gloves', filterKey: 'enduro' },
  
  // Pants
  { id: 'pt_textile', label: 'Текстильные штаны', icon: '🧵', category: 'pants', filterKey: 'textile' },
  { id: 'pt_leather', label: 'Кожаные штаны', icon: '🧥', category: 'pants', filterKey: 'leather' },
  { id: 'pt_jeans', label: 'Джинсы', icon: '👖', category: 'pants', filterKey: 'jeans' },
];
```

### 2.3 Flow Specification

**State Sequence:**
```
equipment → equipment_subcategory → equipment_filtered
```

**Step 1: Initial Category Selection** (Modified)

```typescript
// After selecting equipment category (jacket, gloves, pants, boots)
async function gotoEquipmentSubcategory(
  chatId: number, 
  userId: string, 
  context: EkipFlowContext
): Promise<void> {
  const category = context.selectedCategory; // 'jacket', 'gloves', etc.
  
  await setState(userId, "equipment_subcategory", context);
  
  const subcategories = EQUIPMENT_SUBCATEGORIES.filter(sc => sc.category === category);
  
  await sendComplexMessage(
    chatId,
    `*${getCategoryLabel(category)} — выберите тип:*`,
    buildSubcategoryKeyboard(subcategories),
    { keyboardType: 'inline', parseMode: 'Markdown' }
  );
}

function buildSubcategoryKeyboard(subcategories: EquipmentSubcategory[]): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];
  
  // Add "Все" option first
  rows.push([{
    text: `📋 Все модели`,
    callback_data: `eksub_all`,
  }]);
  
  // Add subcategories in pairs
  for (let i = 0; i < subcategories.length; i += 2) {
    const row: KeyboardButton[] = [
      { text: `${subcategories[i].icon} ${subcategories[i].label}`, callback_data: `eksub_${subcategories[i].id}` }
    ];
    
    if (subcategories[i + 1]) {
      row.push({
        text: `${subcategories[i + 1].icon} ${subcategories[i + 1].label}`,
        callback_data: `eksub_${subcategories[i + 1].id}`
      });
    }
    
    rows.push(row);
  }
  
  rows.push([
    { text: "⬅️ Назад", callback_data: "eksub_back" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);
  
  return rows;
}
```

**Step 2: Filter Equipment by Subcategory**

```typescript
// In handleEkipCallback
if (callbackData.startsWith('eksub_')) {
  const subcategoryId = callbackData.slice(6); // Remove 'eksub_'
  
  if (subcategoryId === 'all') {
    // Show all equipment in category
    context.subcategoryFilter = null;
  } else if (subcategoryId === 'back') {
    // Return to category selection
    return gotoCategorySelection(chatId, userId, context);
  } else {
    // Apply subcategory filter
    const subcategory = EQUIPMENT_SUBCATEGORIES.find(sc => sc.id === subcategoryId);
    if (subcategory) {
      context.subcategoryFilter = subcategory.filterKey;
    }
  }
  
  await setState(userId, "equipment_filtered", context);
  
  // Load and filter equipment
  const allEquipment = await getEquipmentCatalog(crewSlug);
  const filtered = filterEquipmentBySubcategory(allEquipment, context);
  
  await sendComplexMessage(
    chatId,
    `*Выберите оборудование:*`,
    buildEquipmentKeyboard(filtered),
    { keyboardType: 'inline', parseMode: 'Markdown' }
  );
  
  return true;
}

function filterEquipmentBySubcategory(
  equipment: EquipmentItem[], 
  context: EkipFlowContext
): EquipmentItem[] {
  const { selectedCategory, subcategoryFilter } = context;
  
  // First filter by category
  let filtered = equipment.filter(eq => eq.specs?.category === selectedCategory);
  
  // Then by subcategory if specified
  if (subcategoryFilter) {
    filtered = filtered.filter(eq => 
      eq.specs?.subcategory === subcategoryFilter ||
      eq.specs?.features?.some(f => f.toLowerCase().includes(subcategoryFilter))
    );
  }
  
  return filtered;
}
```

### 2.4 Database Schema Changes

**Update `cars.specs` schema:**

```sql
-- Add subcategory field to equipment specs
-- Migration: 20260820000001_add_equipment_subcategory.sql

ALTER TABLE public.cars 
  ALTER COLUMN specs TYPE JSONB USING 
    CASE 
      WHEN jsonb_typeof(specs) = 'object' THEN 
        specs || jsonb_build_object(
          'subcategory', 
          COALESCE((specs->>'subcategory'), 'all')
        )
      ELSE '{}'::jsonb
    END;

-- Comment
COMMENT ON COLUMN public.cars.specs IS 
 'JSONB specs for vehicle/equipment. Equipment includes: category, subcategory (summer/winter/textile/leather/enduro), sizes[], colors[], features[], badge, etc.';
```

**Seed Data Example:**

```json
{
  "id": "equip-jacket-summer-pro",
  "make": "MT",
  "model": "Summer Pro",
  "type": "equipment",
  "specs": {
    "category": "jacket",
    "subcategory": "summer",
    "badge": "versatile",
    "sizes": ["S", "M", "L", "XL"],
    "colors": ["Чёрный", "Серый"],
    "features": ["Вентиляция", "Влагостойкость"]
  }
}
```

---

## 3. B.2: Photo Preview for Selected Equipment

### 3.1 Problem Statement

**Current Behavior:** When users select equipment, they only see text (`🪖 MT Street Pro`). No visual confirmation of what they're selecting. If `image_url` exists in the database, it's not displayed.

**User Impact:** Uncertainty about selection, potential mistakes, no visual confirmation before proceeding to customer details.

### 3.2 Solution Design

**Behavior:**
- When user selects an equipment item, send a **photo message** (if `image_url` exists)
- If no photo exists, **silently skip** (no error, no warning)
- Photo is sent **before** the next step's text message

**Implementation Location:** `handleEkipCallback` in `ekip-manual.ts`

### 3.3 Flow Specification

```typescript
// Modified equipment selection callback
if (callbackData.startsWith('eq_')) {
  const eqId = callbackData.slice(3);
  
  if (eqId === 'done') {
    // Proceed to next step
    // ...
    return true;
  }
  
  const equipment = await resolveEquipmentById(eqId);
  if (equipment) {
    context.equipmentId = equipment.id;
    context.equipmentMake = equipment.make;
    context.equipmentModel = equipment.model;
    
    await setState(userId, state, context);
    
    // NEW: Send photo preview if available
    if (equipment.specs?.image_url || equipment.image_url) {
      const photoUrl = equipment.specs?.image_url || equipment.image_url;
      
      try {
        await sendTelegramPhoto(chatId, photoUrl, 
          `📦 ${equipment.make} ${equipment.model}`
        );
      } catch (photoErr) {
        // Silent failure - log but continue
        logger.warn('[/ekip] Failed to send equipment photo:', photoErr);
      }
    }
    
    // Send equipment selection keyboard
    await sendComplexMessage(
      chatId,
      `📦 Выбрано: ${equipment.make} ${equipment.model}`,
      buildEquipmentKeyboard(await getEquipmentCatalog(), eqId),
      { keyboardType: 'inline' }
    );
  }
  
  return true;
}
```

**Helper Function:**

```typescript
async function sendTelegramPhoto(
  chatId: number, 
  photoUrl: string, 
  caption?: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption || undefined,
          parse_mode: 'Markdown',
        }),
      }
    );
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    logger.error('[sendTelegramPhoto] Failed:', error);
    return false;
  }
}
```

### 3.4 Edge Cases

| Case | Behavior |
|------|----------|
| `image_url` is `null` | Skip photo send, continue normally |
| `image_url` is invalid URL | Log warning, skip photo, continue |
| `image_url` points to non-existent file | Log warning, skip photo, continue |
| `image_url` is private storage | Generate signed URL first, then send |

**Private Storage Handling:**

```typescript
async function getEquipmentPhotoUrl(equipment: EquipmentItem): Promise<string | null> {
  const rawUrl = equipment.specs?.image_url || equipment.image_url;
  
  if (!rawUrl) return null;
  
  // If it's a Supabase storage path (not public URL), generate signed URL
  if (rawUrl.startsWith('carpix/') || rawUrl.startsWith('equipment/')) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from('carpix')
        .createSignedUrl(rawUrl.replace('carpix/', ''), 60 * 60); // 1 hour expiry
      
      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      logger.warn('[getEquipmentPhotoUrl] Failed to generate signed URL:', err);
      return null;
    }
  }
  
  return rawUrl;
}
```

---

## 4. B.3: Size Display & Selection

### 4.1 Problem Statement

**Current Behavior:** Equipment items with multiple sizes (S, M, L, XL) are displayed as a single entry. Users cannot specify which size they're renting. The contract doesn't include size information.

**User Impact:** Operators must manually track sizes separately, potential confusion at handoff, incomplete documentation.

### 4.2 Solution Design

**State:** `equipment_size`

**Callback Prefix:** `eksz_`

**Size Selection Flow:**
```
equipment → (if sizes.length > 1) → equipment_size → next_step
```

**Schema Requirements:** `equipment.specs.sizes` must be an array of strings

### 4.3 Flow Specification

**Step 1: Check for Sizes After Equipment Selection**

```typescript
// After equipment is selected
if (callbackData.startsWith('eq_') && eqId !== 'done') {
  const equipment = await resolveEquipmentById(eqId);
  if (equipment) {
    context.equipmentId = equipment.id;
    context.equipmentMake = equipment.make;
    context.equipmentModel = equipment.model;
    
    // Check if equipment has multiple sizes
    const sizes = equipment.specs?.sizes || [];
    
    if (sizes.length > 1) {
      // Go to size selection
      await gotoEquipmentSize(chatId, userId, context, equipment);
      return true;
    } else if (sizes.length === 1) {
      // Single size - auto-select
      context.selectedSize = sizes[0];
      await setState(userId, state, context);
      // Proceed to next step
      return gotoNextStep(chatId, userId, context);
    } else {
      // No sizes - proceed normally
      await setState(userId, state, context);
      return gotoNextStep(chatId, userId, context);
    }
  }
}
```

**Step 2: Size Selection UI**

```typescript
async function gotoEquipmentSize(
  chatId: number, 
  userId: string, 
  context: EkipFlowContext, 
  equipment: EquipmentItem
): Promise<void> {
  const sizes = equipment.specs?.sizes || [];
  
  await setState(userId, "equipment_size", context);
  
  await sendComplexMessage(
    chatId,
    `*${equipment.make} ${equipment.model}*\n\nВыберите размер:`,
    buildSizeKeyboard(sizes),
    { keyboardType: 'inline', parseMode: 'Markdown' }
  );
}

function buildSizeKeyboard(sizes: string[]): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];
  
  // Display sizes in pairs
  for (let i = 0; i < sizes.length; i += 2) {
    const row: KeyboardButton[] = [
      { text: `📏 ${sizes[i]}`, callback_data: `eksz_${sizes[i]}` }
    ];
    
    if (sizes[i + 1]) {
      row.push({ text: `📏 ${sizes[i + 1]}`, callback_data: `eksz_${sizes[i + 1]}` });
    }
    
    rows.push(row);
  }
  
  rows.push([
    { text: "⬅️ Назад", callback_data: "eksz_back" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);
  
  return rows;
}
```

**Step 3: Handle Size Selection**

```typescript
// In handleEkipCallback
if (callbackData.startsWith('eksz_')) {
  const size = callbackData.slice(5); // Remove 'eksz_'
  
  if (size === 'back') {
    // Return to equipment selection
    return gotoEquipmentSelection(chatId, userId, context);
  }
  
  // Store selected size
  context.selectedSize = size;
  
  await setState(userId, getNextState(context), context);
  
  // Proceed to next step (deal_type or name)
  await sendComplexMessage(
    chatId,
    `✅ Размер: ${size}\n\n${getNextPrompt(context)}`,
    getNextKeyboard(context),
    { keyboardType: 'inline', parseMode: 'Markdown' }
  );
  
  return true;
}
```

### 4.4 Contract Integration

**Update template variables:**

```typescript
interface EquipmentContractVars {
  // ... existing vars
  
  // NEW: Size information
  equipment_size?: string;
  equipment_size_label?: string;  // "Размер: M"
}

// In generateContract function
if (context.selectedSize) {
  vars.equipment_size = context.selectedSize;
  vars.equipment_size_label = `Размер: ${context.selectedSize}`;
}
```

**Template Update (HTML):**

```html
<!-- In equipment list section -->
<p style="text-indent: 1.25cm; text-align: justify;">1.2. Экипировка, предоставляемая по настоящему Договору:</p>
{{equipment_list}}
{{#if equipment_size_label}}
<p style="text-indent: 1.25cm; text-align: justify;">Размер: {{equipment_size}}</p>
{{/if}}
```

### 4.5 Database Schema

**Add `selected_size` to context interface:**

```typescript
interface EkipFlowContext {
  // ... existing fields
  
  // NEW: Size selection
  selectedSize?: string;
}
```

---

## 5. B.4: Color/Material Variant Selection

### 5.1 Problem Statement

**Current Behavior:** Equipment items with multiple colors or materials (e.g., "MT Summer Pro" in Black and White) are stored as separate database rows. This creates duplicate entries and complicates inventory management.

**User Impact:** Inflated catalog, difficult to see all variants of a single model, no unified price/feature management across variants.

### 5.2 Solution Design

**Approach:** Store colors/materials as **variant attributes** within a single equipment record, with separate price/image tracking per variant.

**State:** `equipment_variant`

**Callback Prefix:** `ekvar_`

**Variant Schema:**

```typescript
interface EquipmentVariant {
  id: string;  // e.g., "color_black", "color_white", "mat_textile", "mat_leather"
  label: string;
  type: 'color' | 'material';
  priceModifier?: number;  // e.g., +500 for leather vs textile
  imageUrl?: string;  // Variant-specific image
}

interface EquipmentItem {
  id: string;
  make: string;
  model: string;
  specs: {
    category: string;
    variants?: EquipmentVariant[];
    defaultVariantId?: string;  // If no selection made
  };
}
```

### 5.3 Flow Specification

**State Sequence:**
```
equipment → (if variants.length > 1) → equipment_variant → equipment_size → ...
```

**Step 1: Check for Variants**

```typescript
// After equipment selection
if (callbackData.startsWith('eq_') && eqId !== 'done') {
  const equipment = await resolveEquipmentById(eqId);
  if (equipment) {
    context.equipmentId = equipment.id;
    
    // Check for variants
    const variants = equipment.specs?.variants || [];
    
    if (variants.length > 1) {
      await gotoEquipmentVariant(chatId, userId, context, equipment);
      return true;
    } else {
      // No variants or only one - proceed
      context.selectedVariantId = equipment.specs?.defaultVariantId || variants[0]?.id;
      return gotoNextStep(chatId, userId, context);
    }
  }
}
```

**Step 2: Variant Selection UI**

```typescript
async function gotoEquipmentVariant(
  chatId: number, 
  userId: string, 
  context: EkipFlowContext, 
  equipment: EquipmentItem
): Promise<void> {
  const variants = equipment.specs?.variants || [];
  
  await setState(userId, "equipment_variant", context);
  
  // Group variants by type
  const colorVariants = variants.filter(v => v.type === 'color');
  const materialVariants = variants.filter(v => v.type === 'material');
  
  const message = `*${equipment.make} ${equipment.model}*\n\n`;
  const keyboard: KeyboardButton[][] = [];
  
  // Colors first
  if (colorVariants.length > 0) {
    message += '*Цвет:*';
    keyboard.push(
      colorVariants.map(v => ({
        text: `🎨 ${v.label}${v.priceModifier ? ` (+${v.priceModifier}₽)` : ''}`,
        callback_data: `ekvar_${v.id}`,
      }))
    );
  }
  
  // Materials second
  if (materialVariants.length > 0) {
    if (colorVariants.length > 0) keyboard.push([{ text: '───────────', callback_data: 'ekvar_sep' }]);
    message += '\n*Материал:*';
    keyboard.push(
      materialVariants.map(v => ({
        text: `🧵 ${v.label}${v.priceModifier ? ` (+${v.priceModifier}₽)` : ''}`,
        callback_data: `ekvar_${v.id}`,
      }))
    );
  }
  
  keyboard.push([
    { text: "⬅️ Назад", callback_data: "ekvar_back" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);
  
  await sendComplexMessage(chatId, message, keyboard, { keyboardType: 'inline', parseMode: 'Markdown' });
}
```

**Step 3: Handle Variant Selection**

```typescript
if (callbackData.startsWith('ekvar_')) {
  const variantId = callbackData.slice(6);
  
  if (variantId === 'back') {
    return gotoEquipmentSelection(chatId, userId, context);
  }
  
  if (variantId === 'sep') {
    return true;  // Separator - no action
  }
  
  const equipment = await resolveEquipmentById(context.equipmentId);
  const variant = equipment?.specs?.variants?.find(v => v.id === variantId);
  
  if (variant) {
    context.selectedVariantId = variantId;
    context.variantPriceModifier = variant.priceModifier || 0;
    context.variantImageUrl = variant.imageUrl;
    
    await setState(userId, "equipment_variant_confirmed", context);
    
    // Show confirmation with variant-specific photo if available
    if (variant.imageUrl) {
      await sendTelegramPhoto(chatId, variant.imageUrl, 
        `✅ ${variant.label}: ${equipment?.make} ${equipment?.model}`
      );
    }
    
    // Proceed to size selection (if applicable) or next step
    return gotoNextStep(chatId, userId, context);
  }
  
  return true;
}
```

### 5.4 Price Calculation with Variants

```typescript
function calculatePriceWithVariant(
  equipment: EquipmentItem, 
  variantId?: string
): number {
  const basePrice = equipment.specs?.daily_price || 0;
  
  if (!variantId) return basePrice;
  
  const variant = equipment.specs?.variants?.find(v => v.id === variantId);
  const modifier = variant?.priceModifier || 0;
  
  return basePrice + modifier;
}

// Example:
// Base price: 500₽
// Leather variant: +200₽
// Final price: 700₽
```

### 5.5 Database Schema

**Update `cars.specs` schema:**

```sql
-- Add variants field to equipment specs
-- Migration: 20260820000002_add_equipment_variants.sql

-- Example spec with variants:
{
  "specs": {
    "category": "jacket",
    "subcategory": "summer",
    "variants": [
      {
        "id": "mat_textile",
        "label": "Текстиль",
        "type": "material",
        "priceModifier": 0,
        "imageUrl": "carpix/equip-jacket-summer-pro/textile.jpg"
      },
      {
        "id": "mat_leather",
        "label": "Кожа",
        "type": "material",
        "priceModifier": 500,
        "imageUrl": "carpix/equip-jacket-summer-pro/leather.jpg"
      }
    ],
    "defaultVariantId": "mat_textile",
    "sizes": ["S", "M", "L", "XL"],
    "colors": ["Чёрный"]
  }
}
```

### 5.6 Context Interface

```typescript
interface EkipFlowContext {
  // ... existing fields
  
  // NEW: Variant selection
  selectedVariantId?: string;
  variantPriceModifier?: number;
  variantImageUrl?: string;
}
```

---

## 6. B.5: Admin Equipment Photo Upload

### 6.1 Problem Statement

**Current State:** Equipment items in the database have empty or missing `image_url` fields. Admins have no way to upload equipment photos through the admin interface. The bike photo upload system exists but is not available for equipment.

**User Impact:** Catalog has no visual representation of equipment, reduced user confidence in rentals, incomplete catalog presentation.

### 6.2 Solution Design

**Approach:** Extend the existing bike photo upload system to support equipment, using the same `carpix` storage bucket with equipment-specific paths.

**Path Schema:**
```
carpix/
  └─ <equipment_id>/
     ├─ image_1.jpg  (primary - displayed in catalog)
     ├─ image_2.jpg  (gallery)
     ├─ image_3.jpg  (gallery)
     └─ ...
```

**Mirrors the existing bike path:** `carpix/<bike_vin>/image_1.jpg`

### 6.3 Admin UI Integration

**Location:** Admin equipment editor modal

**Component:**

```typescript
// app/franchize/[slug]/admin/components/EquipmentPhotoUpload.tsx

'use client';

import { useState } from 'react';
import { uploadEquipmentPhoto } from '@/app/franchize/server-actions/equipment-photos';

interface EquipmentPhotoUploadProps {
  equipmentId: string;
  existingPhotos?: string[];
  onPhotosChange?: (photos: string[]) => void;
}

export function EquipmentPhotoUpload({
  equipmentId,
  existingPhotos = [],
  onPhotosChange,
}: EquipmentPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const result = await uploadEquipmentPhoto({
        equipmentId,
        file,
        isPrimary: existingPhotos.length === 0,  // First photo = primary
      });
      
      if (result.success) {
        const updatedPhotos = [...existingPhotos, result.photoUrl!];
        onPhotosChange?.(updatedPhotos);
      } else {
        setError(result.error || 'Failed to upload');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {existingPhotos.map((photo, idx) => (
          <div key={idx} className="relative">
            <img src={photo} alt={`Photo ${idx + 1}`} className="w-24 h-24 object-cover" />
            {idx === 0 && <span className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2">Главная</span>}
          </div>
        ))}
      </div>
      
      <label className="block">
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id="equipment-photo-upload"
        />
        <span className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 disabled:opacity-50">
          {uploading ? 'Загрузка...' : 'Добавить фото'}
        </span>
      </label>
      
      {error && <p className="text-red-500 text-sm">{error}</p>}
      
      <p className="text-xs text-gray-500">
        Первое фото становится главным (отображается в каталоге).
        Максимум 8 фото на единицу оборудования.
      </p>
    </div>
  );
}
```

### 6.4 Server Action

**File:** `app/franchize/server-actions/equipment-photos.ts`

```typescript
'use server';

import { supabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

interface UploadEquipmentPhotoInput {
  equipmentId: string;
  file: File;
  isPrimary?: boolean;
}

interface UploadEquipmentPhotoResult {
  success: boolean;
  photoUrl?: string;
  error?: string;
}

/**
 * Upload an equipment photo to Supabase storage.
 * 
 * Path: carpix/<equipment_id>/image_N.jpg
 * Where N is the next available sequence number.
 */
export async function uploadEquipmentPhoto(
  input: UploadEquipmentPhotoInput
): Promise<UploadEquipmentPhotoResult> {
  const { equipmentId, file, isPrimary = false } = input;
  
  try {
    // Validate equipment exists
    const { data: equipment, error: equipError } = await supabaseAdmin
      .from('cars')
      .select('id, specs')
      .eq('id', equipmentId)
      .eq('type', 'equipment')
      .maybeSingle();
    
    if (equipError || !equipment) {
      return { success: false, error: 'Оборудование не найдено' };
    }
    
    // Determine next image number
    const bucket = supabaseAdmin.storage.from('carpix');
    const prefix = `${equipmentId}/`;
    
    const { data: existingFiles } = await bucket.list(prefix);
    const maxNum = existingFiles
      ?.map(f => parseInt(f.name.match(/image_(\d+)\.jpg/)?.[1] || '0'))
      .reduce((max, n) => Math.max(max, n), 0) || 0;
    
    const nextNum = isPrimary ? 1 : maxNum + 1;
    const fileName = `image_${nextNum}.jpg`;
    const path = `${prefix}${fileName}`;
    
    // Compress and convert to JPEG
    const buffer = await file.arrayBuffer();
    const compressed = await compressImage(Buffer.from(buffer));
    
    // Upload to storage
    const { error: uploadError } = await bucket.upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    
    if (uploadError) {
      logger.error('[uploadEquipmentPhoto] Upload failed:', uploadError);
      return { success: false, error: uploadError.message };
    }
    
    // Get public URL
    const { data: urlData } = bucket.getPublicUrl(path);
    const photoUrl = urlData.publicUrl;
    
    // Update equipment record
    const specs = equipment.specs || {};
    const gallery = specs.gallery || [];
    
    if (isPrimary) {
      // Update main image_url and add to gallery
      await supabaseAdmin
        .from('cars')
        .update({
          image_url: photoUrl,
          specs: {
            ...specs,
            gallery: [photoUrl, ...gallery.filter(u => u !== specs.image_url)],
          },
        })
        .eq('id', equipmentId);
    } else {
      // Add to gallery only
      await supabaseAdmin
        .from('cars')
        .update({
          specs: {
            ...specs,
            gallery: [...gallery, photoUrl],
          },
        })
        .eq('id', equipmentId);
    }
    
    logger.info('[uploadEquipmentPhoto] Uploaded photo', {
      equipmentId,
      path,
      photoUrl,
    });
    
    return { success: true, photoUrl };
    
  } catch (error) {
    logger.error('[uploadEquipmentPhoto] Exception:', error);
    return { success: false, error: String(error) };
  }
}

async function compressImage(buffer: Buffer): Promise<Buffer> {
  // Reuse existing compression logic
  // From PhotoUploadButton or doc-verifier
  // Max 1600px, quality 80
  // ...
  return buffer; // Placeholder
}
```

### 6.5 Existing Photo Upload Reference

**Bike photo upload:** `components/CarSubmissionForm.tsx` + `hooks/supabase.ts:uploadImage`

**Equipment adaptation:** Same flow, different path (`carpix/<equipment_id>/` instead of `carpix/<vin>/`)

### 6.6 Integration with /ekip B.2

**Connection:** B.5 enables B.2. Once photos are uploaded via admin, B.2's photo preview feature can display them.

**Fallback behavior:** If B.5 is not implemented, B.2 silently skips photo display (as designed).

---

## 7. Implementation Strategy

### 7.1 Recommended Order

**Phase 1 (Quick Wins):**
1. **B.2 Photo Preview** (LOW complexity, HIGH value) — 2 hours
2. **B.5 Admin Photo Upload** (LOW complexity, enables B.2) — 4 hours

**Phase 2 (Core Features):**
3. **B.3 Size Selection** (MEDIUM complexity, HIGH value) — 6 hours
4. **B.1 Subcategory Preselection** (MEDIUM complexity, HIGH value) — 8 hours

**Phase 3 (Advanced):**
5. **B.4 Color/Material Variants** (HIGH complexity, MEDIUM value) — 12 hours

**Total Effort:** ~32 hours (4-5 days)

### 7.2 Dependencies

```
B.5 (Admin Upload) → enables → B.2 (Photo Preview)
B.1 (Subcategories) → improves → B.3/B.4 (reduces items per filter)
B.3 (Sizes) → independent
B.4 (Variants) → extends → B.3 (variant-specific sizes?)
```

### 7.3 Testing Strategy

**Per-feature test coverage:**

| Feature | Unit Tests | Integration Tests | Manual Tests |
|---------|------------|-------------------|--------------|
| B.1 | Parser, keyboard builder | Full flow with subcategory | UX testing |
| B.2 | URL validation, photo send | Photo fetch + send | Visual verification |
| B.3 | Size parsing, keyboard | Full flow with size selection | Contract generation |
| B.4 | Variant matching, price calc | Full flow with variants | Price accuracy |
| B.5 | Upload, compression, storage | Admin UI + /ekip preview | End-to-end |

---

## 8. Testing Specifications

### 8.1 B.1 Test Cases

```typescript
describe('Equipment Subcategory Selection', () => {
  describe('buildSubcategoryKeyboard', () => {
    it('shows "Все модели" as first option');
    it('pairs subcategories in rows');
    it('shows back and cancel buttons');
    it('filters by category');
  });
  
  describe('filterEquipmentBySubcategory', () => {
    it('filters by category first');
    it('applies subcategory filter when set');
    it('returns all when subcategoryFilter is null');
    it('matches specs.subcategory field');
    it('fallback: searches in features array');
  });
  
  describe('gotoEquipmentSubcategory', () => {
    it('sets state to equipment_subcategory');
    it('sends keyboard with subcategories');
    it('handles empty subcategory list');
  });
  
  describe('eksub_ callback', () => {
    it('eksub_all clears filter');
    it('eksub_back returns to categories');
    it('stores filterKey in context');
    it('proceeds to equipment_filtered state');
  });
});
```

### 8.2 B.2 Test Cases

```typescript
describe('Equipment Photo Preview', () => {
  describe('sendTelegramPhoto', () => {
    it('sends photo to Telegram API');
    it('includes caption when provided');
    it('handles invalid URLs gracefully');
    it('returns false on API error');
  });
  
  describe('getEquipmentPhotoUrl', () => {
    it('returns raw URL for public URLs');
    it('generates signed URL for carpix paths');
    it('returns null for missing image_url');
    it('handles 404 from storage');
  });
  
  describe('eq_ callback with photo', () => {
    it('sends photo if image_url exists');
    it('skips photo if image_url is null');
    it('continues flow after photo send');
    it('logs warning on photo failure');
  });
});
```

### 8.3 B.3 Test Cases

```typescript
describe('Equipment Size Selection', () => {
  describe('gotoEquipmentSize', () => {
    it('skips size selection if sizes.length === 1');
    it('skips size selection if sizes.length === 0');
    it('shows size keyboard for multiple sizes');
    it('auto-selects single size');
  });
  
  describe('buildSizeKeyboard', () => {
    it('pairs sizes in rows');
    it('includes back and cancel buttons');
    it('handles empty sizes array');
  });
  
  describe('eksz_ callback', () => {
    it('stores selected size in context');
    it('eksz_back returns to equipment selection');
    it('proceeds to next step');
  });
  
  describe('Contract generation with size', () => {
    it('includes equipment_size in vars');
    it('includes equipment_size_label in vars');
    it('renders size in contract');
  });
});
```

### 8.4 B.4 Test Cases

```typescript
describe('Equipment Variant Selection', () => {
  describe('gotoEquipmentVariant', () => {
    it('groups variants by type');
    it('shows colors before materials');
    it('displays price modifiers');
    it('handles separator button');
  });
  
  describe('calculatePriceWithVariant', () => {
    it('returns base price when no variant');
    it('adds positive price modifiers');
    it('subtracts negative price modifiers');
    it('handles zero modifier');
  });
  
  describe('ekvar_ callback', () => {
    it('stores variant ID in context');
    it('stores price modifier separately');
    it('stores variant-specific image URL');
    it('sends variant photo if available');
    it('ekvar_back returns to equipment selection');
  });
});
```

### 8.5 B.5 Test Cases

```typescript
describe('Equipment Photo Upload', () => {
  describe('uploadEquipmentPhoto', () => {
    it('validates equipment exists');
    it('validates equipment type is "equipment"');
    it('calculates next image number');
    it('uploads to carpix/<equipment_id>/');
    it('sets primary photo as image_url');
    it('adds additional photos to specs.gallery');
    it('compresses image before upload');
  });
  
  describe('EquipmentPhotoUpload component', () => {
    it('displays existing photos');
    it('marks first photo as primary');
    it('shows upload button');
    it('shows upload progress');
    it('displays errors');
  });
});
```

### 8.6 Integration Tests

```typescript
describe('/ekip Enhancement E2E', () => {
  describe('Full flow with all enhancements', () => {
    it('subcategory → photo → size → variant → contract');
    it('handles missing data gracefully');
    it('preserves context across steps');
    it('generates contract with all selections');
  });
  
  describe('Back button preservation', () => {
    it('equipment_variant back → equipment_selection');
    it('equipment_size back → equipment_variant');
    it('subcategory back → category');
  });
});
```

---

## 9. Success Metrics

### 9.1 Feature Adoption

| Feature | Metric | Target | Measurement |
|---------|--------|--------|-------------|
| B.1 Subcategories | % of rentals using subcategory filter | >60% | `context.subcategoryFilter != null` |
| B.2 Photo Preview | % of selections with photo sent | >80% | Photo sends / selections |
| B.3 Size Selection | % of rentals with size specified | >90% | `context.selectedSize != null` |
| B.4 Variants | % of applicable rentals using variants | >40% | `context.selectedVariantId != null` |
| B.5 Photo Upload | % of equipment with ≥1 photo | >95% | `cars.image_url != null` |

### 9.2 UX Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Selection time (with subcategories) | <30 seconds | State timestamps |
| Selection time (without subcategories) | <60 seconds | State timestamps |
| Error rate (invalid selections) | <2% | Error logs / total selections |
| Back button usage | <15% | Back callbacks / total callbacks |

### 9.3 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Equipment rental accuracy (size) | >95% | Return complaints / rentals |
| Customer satisfaction | >4.5/5 | Post-rental surveys |
| Catalog completeness (photos) | >95% | Equipment with photos / total |

---

## Appendix A: Migration Order

```sql
-- 1. Add subcategory field
-- Migration: 20260820000001_add_equipment_subcategory.sql

-- 2. Add variants field
-- Migration: 20260820000002_add_equipment_variants.sql

-- 3. Update existing equipment with subcategory defaults
-- Migration: 20260820000003_backfill_equipment_subcategory.sql

-- 4. Update existing equipment with defaults (if not set)
-- Migration: 20260820000004_backfill_equipment_defaults.sql
```

---

## Appendix B: Code Changes Summary

### Files to Modify

1. **`app/webhook-handlers/commands/ekip-manual.ts`** (main logic)
   - Add subcategory keyboard builder
   - Add variant selection handlers
   - Add size selection handlers
   - Add photo preview in eq_ callback
   - Update context interface
   - Update contract generation

2. **`app/franchize/server-actions/equipment-photos.ts`** (NEW)
   - `uploadEquipmentPhoto`
   - `listEquipmentPhotos`
   - `deleteEquipmentPhoto`

3. **`app/franchize/[slug]/admin/components/EquipmentPhotoUpload.tsx`** (NEW)
   - Photo upload component
   - Gallery display
   - Primary photo toggle

4. **`docs/crewDocs/vip-bike_EQUIPMENT_RENTAL_DEAL_TEMPLATE.html`**
   - Add size variable
   - Add variant variables
   - Update equipment list section

5. **`supabase/migrations/*`**
   - Add subcategory field
   - Add variants field
   - Backfill defaults

---

## Appendix C: Callback Prefix Reference

| Prefix | Purpose | State |
|--------|---------|-------|
| `eksub_` | Subcategory selection | `equipment_subcategory` |
| `eq_` | Equipment selection | `equipment` |
| `eksz_` | Size selection | `equipment_size` |
| `ekvar_` | Variant selection | `equipment_variant` |

---

**Document End**

---

## Change History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-08-20 | Initial enhancement PRD (B.1-B.5) |
