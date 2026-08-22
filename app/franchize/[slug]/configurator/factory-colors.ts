import type { ConfiguratorColorOption } from './configurator-types'

/**
 * Factory color options for VipBike configurator.
 *
 * `id` is the internal stable identifier used by the configurator state.
 * `factoryId` is the code that goes into the production order / DOCX so the
 * factory knows which paint to apply. Keep these in sync with the
 * `factory_color_id` column on the `cars` table when an admin overrides
 * per-bike colors.
 *
 * Availability hints drive the UI badge (in stock / made to order / out of stock).
 * The DOCX template only consumes `label` and `factoryId`, so changing the
 * labels here will surface in generated docs.
 */
export const FACTORY_COLORS: ConfiguratorColorOption[] = [
  { id: 'factory-black',   factoryId: 'VB-FCT-BLK',  label: 'Чёрный матовый',     hex: '#0a0a0a', availability: 'in_stock',       isDefault: true },
  { id: 'factory-white',   factoryId: 'VB-FCT-WHT',  label: 'Белый глянцевый',    hex: '#f8fafc', availability: 'in_stock' },
  { id: 'factory-red',     factoryId: 'VB-FCT-RED',  label: 'Красный гоночный',   hex: '#dc2626', availability: 'in_stock' },
  { id: 'factory-blue',    factoryId: 'VB-FCT-BLU',  label: 'Синий электрик',     hex: '#2563eb', availability: 'in_stock' },
  { id: 'factory-green',   factoryId: 'VB-FCT-GRN',  label: 'Зелёный неон',       hex: '#16a34a', availability: 'made_to_order' },
  { id: 'factory-orange',  factoryId: 'VB-FCT-ORG',  label: 'Оранжевый flame',    hex: '#ea580c', availability: 'made_to_order' },
  { id: 'factory-gray',    factoryId: 'VB-FCT-GRY',  label: 'Серый титан',        hex: '#6b7280', availability: 'in_stock' },
  { id: 'factory-yellow',  factoryId: 'VB-FCT-YEL',  label: 'Жёлтый сигнальный',  hex: '#facc15', availability: 'made_to_order' },
  { id: 'factory-purple',  factoryId: 'VB-FCT-PRP',  label: 'Фиолетовый dusk',    hex: '#7c3aed', availability: 'out_of_stock' },
  { id: 'factory-cyan',    factoryId: 'VB-FCT-CYN',  label: 'Бирюзовый cyber',    hex: '#06b6d4', availability: 'made_to_order' },
]

export const DEFAULT_FACTORY_COLOR: ConfiguratorColorOption =
  FACTORY_COLORS.find((c) => c.isDefault) ?? FACTORY_COLORS[0]

/**
 * Resolve a color by its internal `id`. Returns `undefined` if not found
 * (callers should fall back to DEFAULT_FACTORY_COLOR).
 */
export function getFactoryColorById(id: string | undefined | null): ConfiguratorColorOption | undefined {
  if (!id) return undefined
  return FACTORY_COLORS.find((c) => c.id === id)
}

/**
 * Resolve a color by its factory code. Used by the DOCX builder to recover
 * the human-readable label when only the `factoryId` is available
 * (e.g. when the lead was submitted with an unknown `selectedColorId`).
 */
export function getFactoryColorByFactoryId(factoryId: string | undefined | null): ConfiguratorColorOption | undefined {
  if (!factoryId) return undefined
  return FACTORY_COLORS.find((c) => c.factoryId === factoryId)
}
