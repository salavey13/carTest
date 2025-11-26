export type VprVisualType = 'chart' | 'table' | 'axis' | 'plot' | 'compare' | 'image';

// Base interface for common properties
export interface VprBaseVisual {
  type: VprVisualType;
  title?: string; // Optional title for context
}

// Interface for Chart data (e.g., Pie, Bar, Line)
export interface VprChartData extends VprBaseVisual {
  type: 'chart';
  chartType: 'pie' | 'bar' | 'line'; 
  labels: string[];
  data: number[];
  colors?: string[]; // Optional custom colors (hex codes)
}

// --- NEW: Interface for Table data ---
export interface VprTableData extends VprBaseVisual {
  type: 'table';
  headers: string[];
  rows: string[][]; // Array of rows, where each row is an array of cell strings
}

// Interface for Comparison data (visual size comparison)
export interface VprCompareData extends VprBaseVisual {
  type: 'compare';
  size1: number; // Relative or absolute size/value
  size2: number;
  label1: string;
  label2: string;
  referenceLabel?: string; // e.g., "Длина автомобиля 4,2 м"
}

// Interface for points on a number line/axis
export interface VprAxisPoint {
  value: number;
  label: string;
}

export interface VprAxisData extends VprBaseVisual {
  type: 'axis';
  points: VprAxisPoint[];
  minVal?: number; // Optional explicit range minimum
  maxVal?: number; // Optional explicit range maximum
}

// Interface for points on a 2D plot (e.g., function graph, time series)
export interface VprPlotPoint {
  x: number; 
  y: number;
  label?: string; // Optional label for specific points
}

export interface VprPlotData extends VprBaseVisual {
    type: 'plot';
    points: VprPlotPoint[];
    xLabel?: string; // e.g., "Время, ч"
    yLabel?: string; // e.g., "Температура, °C"
    showLine?: boolean; // Whether to connect points with a line
}

// Interface for direct Image display
// Use this if you want to explicitly link an image via visual_data
export interface VprImageData extends VprBaseVisual {
    type: 'image';
    url: string;
    alt?: string;
    caption?: string;
    width?: number; // Optional width (px)
    height?: number; // Optional height (px)
}

// Union type for all possible visual data structures
export type VprVisualDataType = 
  | VprChartData 
  | VprTableData 
  | VprCompareData 
  | VprAxisData 
  | VprPlotData 
  | VprImageData;