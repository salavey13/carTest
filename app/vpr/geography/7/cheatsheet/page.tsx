'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import type { PointOfInterest, GeoBounds } from '@/lib/map-utils';
import {
  MapPin, CheckCircle, XCircle, ArrowRight, ArrowLeft, Target, Layers,
  Thermometer, Globe, Mountain, Users, Info, Lightbulb, RotateCcw
} from 'lucide-react';

const RacingMap = dynamic(() => import('@/components/maps/RacingMap').then((m) => m.RacingMap), { ssr: false });

/* ═══════════════════════════════════════════════════════════
   TYPES & QUESTION DATA
   ═══════════════════════════════════════════════════════════ */

type QuestionType = 'locate' | 'identify' | 'choice' | 'climate' | 'profile';

interface Question {
  id: number;
  vprType: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer: string | [number, number];
  tolerance?: number; // degrees for locate validation
  mapConfig: {
    bounds: GeoBounds;
    points: PointOfInterest[];
    tileLayer?: 'cartodb-dark' | 'cartodb-light' | 'osm';
    interactionHint: string;
  };
  explanation: string;
  hint?: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    vprType: 'Тип 1 №4918',
    type: 'locate',
    text: 'На карте буквами обозначены крупнейшие озёра мира. Определите, какой буквой на карте обозначено озеро Чад. Кликните по карте в районе озера.',
    correctAnswer: [13.0, 14.0],
    tolerance: 2.5,
    mapConfig: {
      bounds: { top: 25, bottom: -5, left: -10, right: 40 },
      points: [
        { id: 'lake-victoria', name: 'Виктория', type: 'point', icon: '::FaWater::', color: '#3b82f6', coords: [[-1.0, 33.0]] },
        { id: 'lake-tanganyika', name: 'Танганьика', type: 'point', icon: '::FaWater::', color: '#3b82f6', coords: [[-6.0, 29.5]] },
        { id: 'lake-malawi', name: 'Малави', type: 'point', icon: '::FaWater::', color: '#3b82f6', coords: [[-11.5, 34.0]] },
      ],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Кликните по карте рядом с озером Чад (Центральная Африка, южнее Сахары)',
    },
    explanation: 'Озеро Чад расположено в центральной части Африки, на границе Чада, Камеруна, Нигера и Нигерии. Координаты ≈ 13° с.ш., 14° в.д.',
    hint: 'Ищите мелководное озеро в зоне Сахеля, к югу от пустыни Сахара.',
  },
  {
    id: 2,
    vprType: 'Тип 2 №4814',
    type: 'locate',
    text: 'Озеро Виктория относится к числу крупнейших озёр Земли. Отметьте его знаком «V» на карте. Кликните по предполагаемому местоположению.',
    correctAnswer: [-1.0, 33.0],
    tolerance: 2.0,
    mapConfig: {
      bounds: { top: 10, bottom: -12, left: 25, right: 42 },
      points: [],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Кликните по Восточной Африке, в районе экватора',
    },
    explanation: 'Озеро Виктория находится в Восточной Африке, пересекается экватором. Координаты ≈ 1° ю.ш., 33° в.д. Это второе по площади пресное озеро мира.',
    hint: 'Самое большое озеро Африки, исток Белого Нила. Расположено между Угандой, Кенией и Танзанией.',
  },
  {
    id: 3,
    vprType: 'Тип 6 №4147',
    type: 'climate',
    text: 'Определите, какому климатическому поясу соответствует климатограмма №1. Выберите правильный вариант.',
    options: ['Экваториальный', 'Тропический', 'Умеренный', 'Субарктический'],
    correctAnswer: 'Экваториальный',
    mapConfig: {
      bounds: { top: 20, bottom: -20, left: -80, right: -40 },
      points: [
        { id: 'climate-1', name: 'Пункт 1', type: 'point', icon: '::FaChartLine::', color: '#ef4444', coords: [[-3.5, -60.0]] },
      ],
      tileLayer: 'cartodb-light',
      interactionHint: 'Кликните по маркеру, чтобы увидеть климатограмму',
    },
    explanation: 'Климатограмма №1 показывает высокие температуры круглый год (+24…+28°C) и обильные осадки каждый месяц (>150 мм). Это признаки экваториального климата (Амазония, Конго, Зондские о-ва).',
    hint: 'Обратите внимание на отсутствие сухого сезона и стабильно высокую температуру.',
  },
  {
    id: 4,
    vprType: 'Тип 8 №4865',
    type: 'identify',
    text: 'Какой природной зоне мира соответствуют характеристики: жаркое засушливое лето, травяной ковёр (ковыль, типчак), плодородные почвы, сайгаки и суслики?',
    options: ['Тундра', 'Тайга', 'Степь', 'Саванна'],
    correctAnswer: 'Степь',
    mapConfig: {
      bounds: { top: 55, bottom: 45, left: 30, right: 60 },
      points: [
        { id: 'zone-steppe', name: 'Степная зона', type: 'path', icon: '::FaRoute::', color: '#22c55e', coords: [[52, 35], [50, 40], [48, 45], [47, 50], [46, 55]], geojson: undefined, roadHighlight: { glow: true, weight: 6, dashArray: '8,6' } },
      ],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Зелёная линия показывает примерную границу степной зоны. Кликните по варианту ответа.',
    },
    explanation: 'Описание соответствует зоне степей: континентальный климат, чернозёмы, травянистая растительность, копытные и грызуны. Расположена в умеренном поясе Евразии и Северной Америки.',
    hint: 'Зона распахана под зерновые культуры. Зимы ветреные, лето сухое.',
  },
  {
    id: 5,
    vprType: 'Тип 10 №4782',
    type: 'choice',
    text: 'Зональность — одна из важнейших закономерностей географической оболочки. Какое явление является примером её проявления?',
    options: [
      'Смена направления муссонов',
      'Изменение продолжительности светового дня в Москве',
      'Изменение состава атмосферного воздуха с высотой',
      'Изменение среднегодовой температуры вод океана от экватора к полюсам',
    ],
    correctAnswer: 'Изменение среднегодовой температуры вод океана от экватора к полюсам',
    mapConfig: {
      bounds: { top: 70, bottom: -60, left: -180, right: 180 },
      points: [
        { id: 'zonality-arrow', name: 'Широтная зональность', type: 'path', icon: '::FaArrowDown::', color: '#f59e0b', coords: [[60, 0], [40, 0], [20, 0], [0, 0], [-20, 0], [-40, 0], [-60, 0]], roadHighlight: { glow: true, weight: 4, animated: true } },
      ],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Жёлтая линия показывает направление изменения температуры от экватора к полюсам',
    },
    explanation: 'Широтная зональность — изменение природных компонентов от экватора к полюсам из-за неравномерного поступления солнечной радиации. Температура океана закономерно снижается к полюсам.',
    hint: 'Ищите закономерность, связанную с изменением по широте, а не по высоте или сезонам.',
  },
  {
    id: 6,
    vprType: 'Тип 11 №4783',
    type: 'identify',
    text: 'В какой из обозначенных точек на границе литосферных плит происходит образование островных дуг?',
    options: ['Точка 1 (расхождение)', 'Точка 2 (океан-океан)', 'Точка 3 (континент-континент)', 'Точка 4 (трансформный разлом)'],
    correctAnswer: 'Точка 2 (океан-океан)',
    mapConfig: {
      bounds: { top: 45, bottom: 25, left: 120, right: 145 },
      points: [
        { id: 'plate-1', name: '1', type: 'point', icon: '::FaCircle::', color: '#94a3b8', coords: [[38, 125]] },
        { id: 'plate-2', name: '2', type: 'point', icon: '::FaCircle::', color: '#ef4444', coords: [[35, 135]] },
        { id: 'plate-3', name: '3', type: 'point', icon: '::FaCircle::', color: '#94a3b8', coords: [[30, 128]] },
        { id: 'plate-4', name: '4', type: 'point', icon: '::FaCircle::', color: '#94a3b8', coords: [[40, 130]] },
        { id: 'trench', name: 'Жёлоб', type: 'path', icon: '::FaRoute::', color: '#3b82f6', coords: [[34, 133], [35, 135], [36, 137]], roadHighlight: { weight: 3, dashArray: '4,4' } },
      ],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Островные дуги образуются при субдукции океанической плиты под океаническую',
    },
    explanation: 'Островные дуги (Японские, Курильские, Алеутские о-ва) формируются в зонах конвергенции двух океанических плит. Более тяжёлая плита погружается, плавится кора, магма поднимается → вулканические острова.',
    hint: 'Ищите точку рядом с глубоководным жёлобом и цепочкой вулканических островов.',
  },
  {
    id: 7,
    vprType: 'Тип 15 №4338',
    type: 'locate',
    text: 'Определите страну по описанию: пересекается Северным полярным кругом, омывается 3 океанами, сухопутная граница только с одним государством, 1-я по площади и 3-я по населению на материке.',
    correctAnswer: [60.0, -100.0],
    tolerance: 8.0,
    mapConfig: {
      bounds: { top: 85, bottom: 45, left: -140, right: -50 },
      points: [],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Кликните по территории страны в Северной Америке',
    },
    explanation: 'Это Канада. Пересекается полярным кругом, омывается Тихим, Атлантическим и Северным Ледовитым океанами. Граничит только с США. 2-я в мире по площади, 3-я в Северной Америке по населению.',
    hint: 'Страна занимает северную часть материка, столица — Оттава.',
  },
  {
    id: 8,
    vprType: 'Тип 17 №4567',
    type: 'choice',
    text: 'Почему озеро Байкал имеет такую большую глубину (1642 м) по сравнению с другими озёрами России?',
    options: [
      'Ледниковое происхождение котловины',
      'Тектонический разлом (рифтовая зона)',
      'Вулканический кратер',
      'Карстовое вымывание пород',
    ],
    correctAnswer: 'Тектонический разлом (рифтовая зона)',
    mapConfig: {
      bounds: { top: 56, bottom: 51, left: 103, right: 110 },
      points: [
        { id: 'baikal', name: 'Озеро Байкал', type: 'path', icon: '::FaWater::', color: '#0ea5e9', coords: [[55.5, 106], [54.5, 107], [53.5, 108], [52.5, 106.5], [53.5, 105], [54.5, 104.5], [55.5, 106]], roadHighlight: { glow: true, weight: 5 } },
        { id: 'rift', name: 'Рифтовая зона', type: 'path', icon: '::FaRoute::', color: '#ef4444', coords: [[56, 103], [54, 106], [51, 110]], roadHighlight: { weight: 2, dashArray: '6,4' } },
      ],
      tileLayer: 'cartodb-dark',
      interactionHint: 'Красная линия показывает направление Байкальского рифта',
    },
    explanation: 'Байкал находится в активной рифтовой зоне, где земная кора растягивается и опускается. Это тектоническое озеро, которое продолжает углубляться (~2 см/год). Возраст ~25-30 млн лет.',
    hint: 'Самое древнее и глубокое озеро мира. Котловина образована раздвижением плит.',
  },
];

/* ═══════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function ClimateGraph({ type }: { type: 'equatorial' | 'tropical' | 'temperate' }) {
  const data = {
    equatorial: { temps: [26,26,26,26,26,26,25,25,25,25,26,26], rain: [250,220,280,300,290,200,180,190,220,260,280,270] },
    tropical: { temps: [20,21,23,25,27,28,28,27,26,24,22,20], rain: [10,5,5,2,1,0,0,2,8,15,20,12] },
    temperate: { temps: [-10,-8,0,8,15,20,22,20,14,6,-2,-8], rain: [40,35,35,40,50,60,70,65,50,45,40,40] },
  }[type];

  const maxRain = Math.max(...data.rain);
  const maxTemp = 35;
  const w = 280, h = 160;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-[#0a1a14] rounded-lg border border-emerald-800/30 p-2">
      {/* Grid */}
      {[0, 1, 2, 3, 4].map(i => <line key={`gy${i}`} x1="30" y1={20 + i*30} x2={w-10} y2={20 + i*30} stroke="#1e293b" strokeWidth="0.5" />)}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <line key={`gx${i}`} x1={30 + i*20} y1="20" x2={30 + i*20} y2={h-20} stroke="#1e293b" strokeWidth="0.5" />)}
      
      {/* Rain bars */}
      {data.rain.map((r, i) => (
        <rect key={`r${i}`} x={32 + i*20} y={h - 20 - (r/maxRain)*100} width="16" height={(r/maxRain)*100} fill="#3b82f6" opacity="0.6" rx="2" />
      ))}
      
      {/* Temp line */}
      <polyline
        points={data.temps.map((t, i) => `${30 + i*20 + 10},${20 + (maxTemp - t)/maxTemp * 100}`).join(' ')}
        fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round"
      />
      {data.temps.map((t, i) => (
        <circle key={`t${i}`} cx={30 + i*20 + 10} cy={20 + (maxTemp - t)/maxTemp * 100} r="3" fill="#ef4444" />
      ))}
      
      {/* Labels */}
      <text x="10" y="15" fill="#94a3b8" fontSize="8">°С / мм</text>
      {['Я','Ф','М','А','М','И','И','А','С','О','Н','Д'].map((m, i) => (
        <text key={m} x={30 + i*20 + 10} y={h-5} fill="#64748b" fontSize="7" textAnchor="middle">{m}</text>
      ))}
    </svg>
  );
}

function FeedbackBadge({ status, text }: { status: 'success' | 'error' | 'hint'; text: string }) {
  const styles = {
    success: 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300',
    error: 'bg-red-900/40 border-red-500/50 text-red-300',
    hint: 'bg-amber-900/40 border-amber-500/50 text-amber-300',
  };
  const Icon = status === 'success' ? CheckCircle : status === 'error' ? XCircle : Lightbulb;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${styles[status]}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function Geography7Practice() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | [number, number] | null>>({});
  const [userClick, setUserClick] = useState<[number, number] | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQ = QUESTIONS[currentIndex];
  const hasAnswered = answers[currentQ.id] !== undefined && answers[currentQ.id] !== null;
  const isCorrect = hasAnswered && answers[currentQ.id] === currentQ.correctAnswer;

  const progress = useMemo(() => {
    const answered = Object.keys(answers).length;
    return (answered / QUESTIONS.length) * 100;
  }, [answers]);

  const score = useMemo(() => {
    return QUESTIONS.reduce((acc, q) => {
      const ans = answers[q.id];
      return acc + (ans === q.correctAnswer ? 1 : 0);
    }, 0);
  }, [answers]);

  const mapPoints = useMemo<PointOfInterest[]>(() => {
    const base = currentQ.mapConfig.points || [];
    const points = [...base];

    if (userClick) {
      points.push({
        id: 'user-click',
        name: 'Ваш выбор',
        type: 'point',
        icon: '::FaMapMarkerAlt::',
        color: isCorrect ? '#22c55e' : '#ef4444',
        coords: [userClick],
      });
    }

    if (showHint && currentQ.type === 'locate') {
      const correct = currentQ.correctAnswer as [number, number];
      points.push({
        id: 'hint-zone',
        name: 'Подсказка',
        type: 'point',
        icon: '::FaBullseye::',
        color: '#f59e0b',
        coords: [correct],
      });
    }

    return points;
  }, [currentQ, userClick, isCorrect, showHint]);

  const validateLocate = useCallback((click: [number, number]) => {
    if (currentQ.type !== 'locate') return false;
    const target = currentQ.correctAnswer as [number, number];
    const tol = currentQ.tolerance || 2;
    return Math.abs(click[0] - target[0]) <= tol && Math.abs(click[1] - target[1]) <= tol;
  }, [currentQ]);

  const handleMapClick = useCallback((coords: [number, number]) => {
    if (hasAnswered) return;
    if (currentQ.type !== 'locate') return;

    setUserClick(coords);
    const correct = validateLocate(coords);
    setAnswers(prev => ({ ...prev, [currentQ.id]: correct ? currentQ.correctAnswer : `miss:${coords.join(',')}` }));
    setShowExplanation(true);
  }, [currentQ, hasAnswered, validateLocate]);

  const handleChoiceAnswer = useCallback((option: string) => {
    if (hasAnswered) return;
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }));
    setShowExplanation(true);
  }, [currentQ, hasAnswered]);

  const nextQuestion = () => {
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserClick(null);
      setShowHint(false);
      setShowExplanation(false);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserClick(null);
      setShowHint(false);
      setShowExplanation(false);
    }
  };

  const resetPractice = () => {
    setAnswers({});
    setCurrentIndex(0);
    setUserClick(null);
    setShowHint(false);
    setShowExplanation(false);
  };

  return (
    <div className="min-h-screen bg-[#070f0b] text-emerald-50 p-4 md:p-6 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-xs mb-2 uppercase tracking-wider font-bold">
                <Target className="w-3.5 h-3.5" /> VPR_GEO_7 // INTERACTIVE
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Практика по картам
              </h1>
              <p className="text-emerald-400/60 text-sm mt-1">Кликай по карте, выбирай зоны, анализируй климат</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-black/30 text-emerald-300 border-emerald-700/50">
                {score} / {QUESTIONS.length}
              </Badge>
              <Button variant="outline" size="sm" onClick={resetPractice} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Сброс
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-1.5 bg-emerald-950/50" />
        </motion.header>

        {/* Main Layout */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Map Panel */}
          <div className="lg:col-span-3">
            <Card className="bg-[#0a1a14] border-emerald-800/40 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-400" />
                  {currentQ.vprType}
                </CardTitle>
                <CardDescription className="text-emerald-500/60">{currentQ.mapConfig.interactionHint}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[45vh] md:h-[55vh] w-full relative">
                  <RacingMap
                    points={mapPoints}
                    bounds={currentQ.mapConfig.bounds}
                    tileLayer={currentQ.mapConfig.tileLayer || 'cartodb-dark'}
                    className="h-full w-full"
                    onMapClick={handleMapClick}
                    onPointClick={(poi) => {
                      if (currentQ.type === 'climate' && poi.id === 'climate-1') {
                        setShowExplanation(true);
                      }
                    }}
                  />
                  {currentQ.type === 'locate' && !hasAnswered && (
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-emerald-300 border border-emerald-700/40 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Кликните по карте
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Panel */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <Card className="bg-[#0a1a14] border-emerald-800/40">
                  <CardHeader>
                    <CardTitle className="text-base leading-relaxed">{currentQ.text}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Climate Graph */}
                    {currentQ.type === 'climate' && <ClimateGraph type="equatorial" />}

                    {/* Options */}
                    {currentQ.options && (
                      <div className="space-y-2">
                        {currentQ.options.map((opt) => {
                          const isSelected = answers[currentQ.id] === opt;
                          const isCorrectOpt = opt === currentQ.correctAnswer;
                          const showResult = hasAnswered;
                          let btnClass = 'w-full justify-start text-left p-3 rounded-lg border transition-all ';
                          if (showResult) {
                            btnClass += isCorrectOpt ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : isSelected ? 'bg-red-900/40 border-red-500/50 text-red-300' : 'bg-black/20 border-emerald-900/30 text-gray-500';
                          } else {
                            btnClass += 'bg-black/20 border-emerald-900/30 hover:bg-emerald-900/20 hover:border-emerald-700/50 text-gray-300';
                          }
                          return (
                            <Button
                              key={opt}
                              variant="outline"
                              className={btnClass}
                              onClick={() => handleChoiceAnswer(opt)}
                              disabled={hasAnswered}
                            >
                              {opt}
                              {showResult && isCorrectOpt && <CheckCircle className="w-4 h-4 ml-auto text-emerald-400" />}
                              {showResult && isSelected && !isCorrectOpt && <XCircle className="w-4 h-4 ml-auto text-red-400" />}
                            </Button>
                          );
                        })}
                      </div>
                    )}

                    {/* Hint & Explanation */}
                    <div className="space-y-2">
                      {!hasAnswered && currentQ.hint && (
                        <Button variant="ghost" size="sm" onClick={() => setShowHint(true)} className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" /> Подсказка
                        </Button>
                      )}
                      {showHint && currentQ.hint && <FeedbackBadge status="hint" text={currentQ.hint} />}
                      {showExplanation && <FeedbackBadge status={isCorrect ? 'success' : 'error'} text={currentQ.explanation} />}
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={prevQuestion} disabled={currentIndex === 0} className="gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Назад
                  </Button>
                  <span className="text-xs text-emerald-500/60 font-mono">{currentIndex + 1} / {QUESTIONS.length}</span>
                  {currentIndex < QUESTIONS.length - 1 ? (
                    <Button size="sm" onClick={nextQuestion} className="gap-1.5 bg-emerald-700 hover:bg-emerald-600">
                      Далее <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Badge variant="default" className="bg-emerald-700 text-white">Финиш</Badge>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Quick Stats */}
            <Card className="bg-[#0a1a14] border-emerald-800/30">
              <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-black/20 p-2 rounded-lg">
                  <div className="text-lg font-bold text-emerald-400">{score}</div>
                  <div className="text-[10px] text-gray-500">Верно</div>
                </div>
                <div className="bg-black/20 p-2 rounded-lg">
                  <div className="text-lg font-bold text-amber-400">{Object.keys(answers).length - score}</div>
                  <div className="text-[10px] text-gray-500">Ошибки</div>
                </div>
                <div className="bg-black/20 p-2 rounded-lg">
                  <div className="text-lg font-bold text-sky-400">{Math.round((score / Math.max(1, Object.keys(answers).length)) * 100)}%</div>
                  <div className="text-[10px] text-gray-500">Точность</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
