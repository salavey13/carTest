export interface VprChartData {
  type: 'chart';
  data: number[];
  labels: string[];
  title?: string; // Optional title for context
}

export interface VprCompareData {
  type: 'compare';
  size1: number; // Relative or absolute size/value
  size2: number;
  label1: string;
  label2: string;
  referenceLabel?: string; // e.g., "Длина автомобиля 4,2 м"
}

export interface VprAxisPoint {
  value: number;
  label: string;
}

export interface VprAxisData {
  type: 'axis';
  points: VprAxisPoint[];
  minVal?: number; // Optional explicit range
  maxVal?: number;
}

// Add PlotData for Q15 type graphs
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


// Union type for all possible visual data structures
export type VprVisualDataType = VprChartData | VprCompareData | VprAxisData | VprPlotData;

// Master dictionary mapping unique question keys to their visual data
// Key format: "subj<SubjectID>-var<VariantNumber>-pos<Position>"
export const vprVisuals: Record<string, VprVisualDataType> = {
  // --- SUBJECT: Математика (ID assumed 1, Grade 7 assumed for these) ---
  // --- Variant 1 (K1V1) ---
  'subj1-var1-pos7': { // Q7: Овсяное печенье диаграмма
    type: 'chart',
    data: [15, 15, 60, 10], // Approximate percentages: Жиры, Белки, Углеводы, Прочее
    labels: ['Жиры', 'Белки', 'Углеводы', 'Прочее'],
    title: 'Содержание питательных веществ (примерно)',
  },
   'subj1-var1-pos8': { // Q8: График линейной функции (y=2x-1)
     type: 'plot',
     // Plotting a few points to represent y=2x-1. Exact visual not required, just representation.
     points: [{x: 0, y: -1}, {x: 1, y: 1}, {x: 2, y: 3}, {x: -1, y: -3}],
     xLabel: 'x',
     yLabel: 'y',
     title: 'График y = 2x - 1 (схематично)'
   },
  'subj1-var1-pos12': { // Q12: Точки на прямой A(1.6), B(-0.5), C(-2.75) - B assumed from answers
    type: 'axis',
    points: [{ value: 1.6, label: 'A' }, { value: -0.5, label: 'B' }, { value: -2.75, label: 'C' }],
    minVal: -3,
    maxVal: 3,
  },
   'subj1-var1-pos13': { // Q13: Расстояние от A до BC (по клеткам)
     // This is geometric, might be hard to represent well without a grid.
     // Let's skip a custom component for this one for now, placeholder remains.
     type: 'axis', // Or maybe another type? Placeholder for now.
     points: [], // No specific points needed, more about grid context.
   },
  'subj1-var1-pos15': { // Q15: График температуры
    type: 'plot',
    // Using numerical representation for time for simplicity (hours from start)
    points: [
      { x: 0, y: 27, label: '15:00(25)' }, // 15:00 25 Aug
      { x: 3, y: 18, label: '18:00' },      // 18:00 25 Aug
      { x: 6, y: 15, label: '21:00' },      // 21:00 25 Aug
      { x: 9, y: 18, label: '00:00' },      // 00:00 26 Aug (потеплело)
      { x: 12, y: 12, label: '03:00' },     // 03:00 26 Aug
      { x: 15, y: 9, label: '06:00' },      // 06:00 26 Aug (восход)
      { x: 21, y: 15, label: '12:00' },     // 12:00 26 Aug
      { x: 24, y: 21, label: '15:00(26)' }, // 15:00 26 Aug (27-6=21)
    ],
    xLabel: 'Время (часы от 15:00 25 авг)',
    yLabel: 'Температура, °C',
    title: 'Изменение температуры (схематично)',
  },

  // --- Variant 2 (K1V2) ---
  'subj1-var2-pos7': { // Q7: Продажи бытовой техники
    type: 'chart',
    // Data represents thousands of units (approx based on percentages)
    // Total 400k. Спец=37.5% -> 150k, Супер=20% -> 80k, Гипер=30% -> 120k, Онлайн=12.5% -> 50k
    data: [150, 80, 120, 50],
    labels: ['Спец.', 'Суперм.', 'Гиперм.', 'Онлайн'],
    title: 'Продажи быт. техники (тыс. шт.)',
  },
  'subj1-var2-pos8': { // Q8: График y=k/x через (10, -6)
      type: 'plot',
      // k = y*x = -6 * 10 = -60. Plotting a few points for y = -60/x
      points: [{x: 10, y: -6}, {x: 6, y: -10}, {x: -6, y: 10}, {x: -10, y: 6}],
      xLabel: 'x',
      yLabel: 'y',
      title: 'График y = k/x (схематично)'
  },
  'subj1-var2-pos12': { // Q12: Точки на прямой A(4.69), B(-2.5), C(-4.34) - B assumed from answers
    type: 'axis',
    points: [{ value: 4.69, label: 'A' }, { value: -2.5, label: 'B' }, { value: -4.34, label: 'C' }],
    minVal: -5,
    maxVal: 5,
  },
   'subj1-var2-pos13': { // Q13: Точки на клетчатой бумаге
     // Geometric, skip custom component for now.
     type: 'axis', // Placeholder
     points: [],
   },
  'subj1-var2-pos15': { // Q15: Цена на алюминий
    type: 'plot',
    // Data points (date -> price)
    points: [
      { x: 23, y: 125600, label: '23 янв' },
      { x: 24, y: 126200, label: '24 янв' }, // +600
      { x: 25, y: 125100, label: '25 янв' }, // -1100
      { x: 26, y: 125700, label: '26 янв' },
      { x: 27, y: 125600, label: '27 янв' }, // back to 23rd value
      { x: 28, y: 125600, label: '28 янв' }, // same
      { x: 29, y: 124400, label: '29 янв' }, // -1200
      // Price grew by same amount for 2 days to reach 126400 on 31st
      // Change from 29th to 31st = 126400 - 124400 = 2000 over 2 days = 1000 per day
      { x: 30, y: 125400, label: '30 янв' }, // +1000
      { x: 31, y: 126400, label: '31 янв' }, // +1000
    ],
    xLabel: 'Дата (январь)',
    yLabel: 'Цена за тонну, руб',
    title: 'Цена на алюминий (схематично)',
  },

   // --- SUBJECT: Математика (ID assumed 2, Grade 6 assumed for these) ---
   // --- Variant 4 (K7V1, Grade 6) ---
   'subj2-var4-pos5': {
     type: 'compare',
     size1: 900, // Approx visual size, not exact answer
     size2: 420,
     label1: 'Автобус (прим.)',
     label2: 'Автомобиль',
     referenceLabel: 'Длина автомобиля 4,2 м (420 см)',
   },
   'subj2-var4-pos6': {
     type: 'chart',
     data: [3, 6, 8, 5],
     labels: ['Оц. "2"', 'Оц. "3"', 'Оц. "4"', 'Оц. "5"'],
     title: 'Результаты контрольной 6 «В»',
   },
   'subj2-var4-pos8': {
     type: 'axis',
     // Using VPR answer sheet coordinates (4=1.5, 1=2.105, 2=3.5) despite visual contradiction
     points: [{ value: 1.5, label: 'A' }, { value: 2.105, label: 'B' }, { value: 3.5, label: 'C' }],
     minVal: 0,
     maxVal: 4,
   },
   // Q12 (Drawing) - Skip custom component

   // --- Variant 5 (K7V2, Grade 6) ---
    'subj2-var5-pos5': {
        type: 'compare',
        size1: 4.1,
        size2: 2.7, // Approx visual size
        label1: 'Дерево',
        label2: 'Куст (прим.)',
        referenceLabel: 'Высота дерева 4,1 м',
    },
    'subj2-var5-pos6': {
        type: 'chart',
        // Need actual precipitation data if available, using placeholders
        data: [40, 35, 50, 65, 78, 60, 68, 72, 55, 71, 45, 40], // Example data
        labels: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
        title: 'Осадки в Томске (мм, пример)',
    },
    'subj2-var5-pos8': {
        type: 'axis',
        // Using VPR answer sheet coordinates (4=-3 2/7, 3=-2 2/9, 1=2 2/7)
        points: [{ value: -3 - 2/7, label: 'P' }, { value: -2 - 2/9, label: 'Q' }, { value: 2 + 2/7, label: 'R' }],
        minVal: -4,
        maxVal: 4,
    },
   // Q12 (Cube rotation) - Skip custom component (too complex for simple visuals)

   // --- Variant 6 (K8V1, Grade 6) ---
    'subj2-var6-pos5': {
        type: 'compare',
        size1: 10,
        size2: 7, // Approx visual size
        label1: 'Дом',
        label2: 'Столб (прим.)',
        referenceLabel: 'Высота дома 10 м',
    },
    'subj2-var6-pos6': {
        type: 'chart',
        data: [5, 8, 10, 6, 7], // Example data if real is unavailable
        labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
        title: 'Посещаемость кружка',
    },
    'subj2-var6-pos8': {
        type: 'axis',
        points: [{ value: -1.6, label: 'A' }, { value: 0.55, label: 'B' }, { value: 2.8, label: 'C' }],
        minVal: -2,
        maxVal: 3,
    },
   // Q12 (Cube removal) - Skip custom component

   // --- Variant 7 (K8V2, Grade 6) ---
    'subj2-var7-pos5': {
        type: 'compare',
        size1: 8,
        size2: 4.5, // Approx visual size
        label1: 'Грузовик',
        label2: 'Легковой (прим.)',
        referenceLabel: 'Длина грузовика 8 м',
    },
    'subj2-var7-pos6': {
        type: 'plot', // Using plot for temperature over time
        // Need actual temp data, using placeholders
        points: [ {x:0, y:8}, {x:3, y:9}, {x:6, y:10}, {x:9, y:13}, {x:12, y:15}, {x:15, y:14}, {x:18, y:12}, {x:21, y:10}, {x:24, y:8} ],
        xLabel: 'Время (часы)',
        yLabel: 'Температура (°C)',
        title: 'Температура воздуха (пример)',
    },
    'subj2-var7-pos8': {
        type: 'axis',
        points: [{ value: -1/3, label: 'P' }, { value: 1.15, label: 'Q' }, { value: 3.05, label: 'R' }],
        minVal: -1,
        maxVal: 4,
    },
   // Q12 (Symmetry drawing) - Skip custom component

   // --- Variant 8 (K9V1, Grade 6) ---
    'subj2-var8-pos5': {
        type: 'compare',
        size1: 105, // Approx visual size ratio
        size2: 15,
        label1: 'Стол (прим.)',
        label2: 'Карандаш',
        referenceLabel: 'Длина карандаша 15 см',
    },
    'subj2-var8-pos6': {
        type: 'chart',
        data: [40, 60, 50, 70, 55, 80], // Example data if real unavailable
        labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
        title: 'Продажи книг (шт.)',
    },
    'subj2-var8-pos8': {
        type: 'axis',
        points: [{ value: -2.1, label: 'X' }, { value: 0.05, label: 'Y' }, { value: 1.9, label: 'Z' }],
        minVal: -3,
        maxVal: 3,
    },
   // Q12 (Triangle symmetry) - Skip custom component

   // --- Variant 9 (K9V2, Grade 6) ---
    'subj2-var9-pos5': {
        type: 'compare',
        size1: 2.1, // Approx visual size ratio
        size2: 1.8,
        label1: 'Дверь (прим.)',
        label2: 'Человек',
        referenceLabel: 'Рост человека 1,8 м',
    },
    'subj2-var9-pos6': {
        type: 'chart',
        data: [25, 30, 15, 20, 10], // Example data including others
        labels: ['Детектив', 'Фантастика', 'Классика', 'Приключения', 'Поэзия'],
        title: 'Жанры книг в библиотеке (шт.)',
    },
    'subj2-var9-pos8': {
        type: 'axis',
        points: [{ value: -1.1, label: 'M' }, { value: 0.8, label: 'N' }, { value: 2.05, label: 'K' }],
        minVal: -2,
        maxVal: 3,
    },
   // Q12 (Wire bending) - Skip custom component

  // Add more entries here as needed for other subjects/variants/questions
};

// Helper function to get visual data for a question
export function getVisualDataForQuestion(subjectId: number, variantNumber: number, position: number): VprVisualDataType | null {
  const key = `subj${subjectId}-var${variantNumber}-pos${position}`;
  return vprVisuals[key] || null;
}