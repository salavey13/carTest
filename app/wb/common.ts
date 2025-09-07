import type { Database } from "@/types/database.types";

export const COLOR_MAP: {[key: string]: string} = {
  beige: 'bg-yellow-200',
  blue: 'bg-blue-200',
  red: 'bg-red-200',
  'light-green': 'bg-green-200',
  'dark-green': 'bg-green-500',
  gray: 'bg-gray-200',
  adel: 'bg-blue-100',
  malvina: 'bg-purple-100',
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
};

export const VOXELS = [
  // Левая полка A: 4 ряда x 4 полки
  { id: 'A1', position: { row: 1, col: 1 }, label: 'A1 (Матрасники мал.)' },
  { id: 'A2', position: { row: 1, col: 2 }, label: 'A2 (Матрасники мал.)' },
  { id: 'A3', position: { row: 1, col: 3 }, label: 'A3 (Матрасники бол.)' },
  { id: 'A4', position: { row: 1, col: 4 }, label: 'A4 (Матрасники бол.)' },
  { id: 'A5', position: { row: 2, col: 1 }, label: 'A5 (Полуторки)' },
  { id: 'A6', position: { row: 2, col: 2 }, label: 'A6 (Полуторки)' },
  { id: 'A7', position: { row: 2, col: 3 }, label: 'A7 (Евро Макси)' },
  { id: 'A8', position: { row: 2, col: 4 }, label: 'A8 (Евро Макси)' },
  { id: 'A9', position: { row: 3, col: 1 }, label: 'A9 (Двушки)' },
  { id: 'A10', position: { row: 3, col: 2 }, label: 'A10 (Евро)' },
  { id: 'A11', position: { row: 3, col: 3 }, label: 'A11 (Запас)' },
  { id: 'A12', position: { row: 3, col: 4 }, label: 'A12 (Запас)' },
  { id: 'A13', position: { row: 4, col: 1 }, label: 'A13 (Запас)' },
  { id: 'A14', position: { row: 4, col: 2 }, label: 'A14 (Запас)' },
  { id: 'A15', position: { row: 4, col: 3 }, label: 'A15 (Запас)' },
  { id: 'A16', position: { row: 4, col: 4 }, label: 'A16 (Запас)' },
  // Правая B симметрично
  { id: 'B1', position: { row: 1, col: 1 }, label: 'B1 (Полуторки)' },
  { id: 'B2', position: { row: 1, col: 2 }, label: 'B2 (Запас)' },
  { id: 'B3', position: { row: 1, col: 3 }, label: 'B3 (Запас)' },
  { id: 'B4', position: { row: 1, col: 4 }, label: 'B4 (Запас)' },
  // ... аналогично до B16
];

export type Location = {
  voxel: string;
  quantity: number;
  min_qty?: number; // Для 'B'
};

export type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  locations: Location[];
  total_quantity: number;
  season?: 'leto' | 'zima' | null;
  pattern?: 'kruzheva' | 'mirodel' | 'ogurtsy' | 'flora1' | 'flora2' | 'flora3' | 'adel' | 'malvina';
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

export type WarehousePlateProps = {
  voxel: Voxel;
  contents: Content[];
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdateQty: (itemId: string, voxelId: string, quantity: number) => void;
  items: Item[];
  onPlateClick: (voxelId: string) => void;
  gameMode: 'offload' | 'onload' | null;
};

export type WarehouseItem = Database['public']['Tables']['cars']['Row'] & {
  specs: { 
    size: string; 
    color: string; 
    pattern: string; 
    season: string | null; 
    warehouse_locations: { voxel_id: string; quantity: number }[]; 
    min_quantity?: number; // Для 'B' полок
  };
};