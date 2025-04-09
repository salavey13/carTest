// Interface for Chart data (e.g., Pie or Bar)
export interface VprChartData {
  type: 'chart';
  data: number[];
  labels: string[];
  title?: string; // Optional title for context
  chartType?: 'pie' | 'bar'; // Optional: specify chart type
}

// Interface for Comparison data (visual size comparison)
export interface VprCompareData {
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

export interface VprAxisData {
  type: 'axis';
  points: VprAxisPoint[];
  minVal?: number; // Optional explicit range minimum
  maxVal?: number; // Optional explicit range maximum
}

// Interface for points on a 2D plot (e.g., function graph, time series)
export interface VprPlotPoint {
  x: number | string; // Can be time (string) or numerical value
  y: number;
  label?: string; // Optional label for the point
}
export interface VprPlotData {
    type: 'plot';
    points: VprPlotPoint[];
    xLabel?: string; // e.g., "Время, ч"
    yLabel?: string; // e.g., "Температура, °C"
    title?: string;
}

// --- NEW: Interface for direct Image display ---
// Use this if you want to explicitly link an image via visual_data
// instead of embedding it via Markdown in the question text.
export interface VprImageData {
    type: 'image';
    url: string;
    alt?: string;
    caption?: string;
    width?: string | number; // Optional width control
    height?: string | number; // Optional height control
}


// Union type for all possible visual data structures
// Added VprImageData
export type VprVisualDataType = VprChartData | VprCompareData | VprAxisData | VprPlotData | VprImageData;

// NOTE: The static 'vprVisuals' dictionary and 'getVisualDataForQuestion' function
// have been removed as visual data should now be fetched directly from the
// 'visual_data' JSONB column in the 'vpr_questions' table.