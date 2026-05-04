import type { ConfiguratorColorOption } from './configurator-types'

/**
 * Single source of truth for order-document color mapping.
 * Edit only this file when the factory palette or OEM color codes change.
 */
export const FACTORY_COLORS: ConfiguratorColorOption[] = [
  {
    id: 'matte-black',
    factoryId: 'OEM-BLK-MT',
    label: 'Матовый чёрный',
    hex: '#1A1A1A',
    isDefault: true,
    availability: 'in_stock',
  },
  {
    id: 'snow-white',
    factoryId: 'OEM-WHT-SN',
    label: 'Снежно-белый',
    hex: '#F8F8F8',
    availability: 'in_stock',
  },
  {
    id: 'graphite-gray',
    factoryId: 'OEM-GRY-GR',
    label: 'Графитовый',
    hex: '#4B5563',
    availability: 'made_to_order',
  },
  {
    id: 'neon-cyan',
    factoryId: 'OEM-CYN-NE',
    label: 'Неон-циан',
    hex: '#22D3EE',
    availability: 'made_to_order',
  },
]

export const FACTORY_COLOR_BY_ID = Object.fromEntries(
  FACTORY_COLORS.map((color) => [color.id, color]),
) as Record<string, ConfiguratorColorOption>

export const getFactoryColorById = (id?: string | null): ConfiguratorColorOption | null => {
  if (!id) return null
  return FACTORY_COLOR_BY_ID[id] ?? null
}

export const DEFAULT_FACTORY_COLOR =
  FACTORY_COLORS.find((color) => color.isDefault) ?? FACTORY_COLORS[0] ?? null
