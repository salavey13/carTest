import type { Database } from "@/types/database.types";

// FIXED: Added dark mode variants to COLOR_MAP.
// Light mode uses 200-series pastels.
// Dark mode uses 900-series darks with 40% opacity to tint the background while keeping text readable.
export const COLOR_MAP: {[key: string]: string} = {
  beige: 'bg-yellow-200 dark:bg-yellow-900/40',
  blue: 'bg-blue-200 dark:bg-blue-900/40',
  red: 'bg-red-200 dark:bg-red-900/40',
  'light-green': 'bg-green-200 dark:bg-green-900/40',
  'dark-green': 'bg-green-500 dark:bg-green-800',
  gray: 'bg-gray-200 dark:bg-gray-700/40',
  adel: 'bg-blue-100 dark:bg-blue-900/40',
  malvina: 'bg-purple-100 dark:bg-purple-900/40',
  lavanda: 'bg-purple-200 dark:bg-purple-900/40',
};

export const SIZE_PACK: {[key: string]: number} = {
  '180x220': 8,
  '200x220': 7,
  '220x240': 6,
  '90': 8,
  '120': 8,
  '140': 8,
  '160': 8,
  '180': 8,
  '200': 8,
  '150x200': 6,
  '50x70': 10,
};

export const VOXELS = [
  { id: 'A1', position: { row: 1, col: 1 }, label: 'A1 (евро beige)' },
  { id: 'A2', position: { row: 1, col: 2 }, label: 'A2 (2 blue)' },
  { id: 'A3', position: { row: 1, col: 3 }, label: 'A3 (евро макси red)' },
  { id: 'A4', position: { row: 1, col: 4 }, label: 'A4 (матрасники)' },
  { id: 'A5', position: { row: 2, col: 1 }, label: 'A5 (1.5 запас)' },
  { id: 'A6', position: { row: 2, col: 2 }, label: 'A6 (2 запас)' },
  { id: 'A7', position: { row: 2, col: 3 }, label: 'A7 (евро макси запас)' },
  { id: 'A8', position: { row: 2, col: 4 }, label: 'A8 (матрасники запас)' },
  { id: 'A9', position: { row: 3, col: 1 }, label: 'A9 (2 запас)' },
  { id: 'A10', position: { row: 3, col: 2 }, label: 'A10 (евро запас)' },
  { id: 'A11', position: { row: 3, col: 3 }, label: 'A11 (матрасники мал запас)' },
  { id: 'A12', position: { row: 3, col: 4 }, label: 'A12 (матрасники бол запас)' },
  { id: 'A13', position: { row: 4, col: 1 }, label: 'A13 (запас)' },
  { id: 'A14', position: { row: 4, col: 2 }, label: 'A14 (запас)' },
  { id: 'A15', position: { row: 4, col: 3 }, label: 'A15 (матрасники бол запас)' },
  { id: 'A16', position: { row: 4, col: 4 }, label: 'A16 (матрасники бол запас)' },
  { id: 'B1', position: { row: 1, col: 1 }, label: 'B1 (1.5 gray)' },
  { id: 'B2', position: { row: 1, col: 2 }, label: 'B2 (запас)' },
  { id: 'B3', position: { row: 1, col: 3 }, label: 'B3 (запас)' },
  { id: 'B4', position: { row: 1, col: 4 }, label: 'B4 (запас)' },
];
/* сокращеное кол-во ячеек для запасной секции склада
  { id: 'B5', position: { row: 2, col: 1 }, label: 'B5 (запас)' },
  { id: 'B6', position: { row: 2, col: 2 }, label: 'B6 (запас)' },
  { id: 'B7', position: { row: 2, col: 3 }, label: 'B7 (запас)' },
  { id: 'B8', position: { row: 2, col: 4 }, label: 'B8 (запас)' },
  { id: 'B9', position: { row: 3, col: 1 }, label: 'B9 (запас)' },
  { id: 'B10', position: { row: 3, col: 2 }, label: 'B10 (запас)' },
  { id: 'B11', position: { row: 3, col: 3 }, label: 'B11 (запас)' },
  { id: 'B12', position: { row: 3, col: 4 }, label: 'B12 (запас)' },
  { id: 'B13', position: { row: 4, col: 1 }, label: 'B13 (запас)' },
  { id: 'B14', position: { row: 4, col: 2 }, label: 'B14 (запас)' },
  { id: 'B15', position: { row: 4, col: 3 }, label: 'B15 (запас)' },
  { id: 'B16', position: { row: 4, col: 4 }, label: 'B16 (запас)' },
*/
export type Location = {
  voxel: string;
  quantity: number;
  min_qty?: number;
};

export type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  locations: Location[];
  total_quantity: number;
  season?: 'leto' | 'zima' | null;
  pattern?: 'kruzheva' | 'ogurtsy' | 'adel' | 'malvina' | 'flora' | 'flora 2' | 'flora 3' | 'lavanda';
  color: string;
  size: string;
};

export type Content = {
  item: Item;
  local_quantity: number;
};

export type WarehouseVizProps = {
  items: Item[];
  selectedVoxel: string | null;
  onSelectVoxel: (id: string) => void;
  onUpdateLocationQty: (itemId: string, voxelId: string, quantity: number) => void;
  gameMode: 'offload' | 'onload' | null;
  onPlateClick: (voxelId: string) => void;
};

export type Voxel = typeof VOXELS[0];

export type WarehouseItem = Database['public']['Tables']['cars']['Row'] & {
  specs: { 
    size: string; 
    color: string; 
    pattern: string; 
    season: string | null; 
    warehouse_locations: { voxel_id: string; quantity: number }[]; 
    min_quantity?: number;
  };
};

export function normalizeSizeKey(size?: string | null): string {
  if (!size) return "";
  return size.toString().toLowerCase().trim().replace(/\s/g, "").replace(/×/g, "x");
}