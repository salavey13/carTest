"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, BarChart3, PieChart, Ruler, Brain, Scale, Grid3x3,
  Triangle, TrendingUp, Sigma, GitBranch, Percent, ArrowRightLeft,
  Hash, TriangleAlert, ChevronRight, ChevronLeft, Lightbulb, Star,
  Trophy, Home, RotateCcw, Sparkles, CheckCircle2, XCircle,
  HelpCircle, BookOpen, Zap, Award, Eye, EyeOff, Menu, X,
  ArrowRight, Play, Minus, BookMarked, Target, GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ═══════════════════════ TYPES ═══════════════════════ */

type QuestionType =
  | "expression" | "diagram_rank" | "diagram_pct" | "unit" | "logic"
  | "equation" | "numline" | "grid" | "triangle" | "graph"
  | "algebra" | "system" | "percent" | "parallel" | "ratio"
  | "heights" | "divisibility";

interface Question {
  id: number;
  type: QuestionType;
  typeName: string;
  text: string;
  correctAnswer: string;
  options?: string[];
  hint: string;
  solution: string[];
  difficulty: 1 | 2 | 3;
  answerMode: "choice" | "input" | "interactive";
  barData?: { label: string; value: number; color: string }[];
  numberLineTarget?: number;
  graphData?: { name: string; points: [number, number][]; color: string }[];
  gridData?: { point: [number, number]; lineStart: [number, number]; lineEnd: [number, number]; gridSize: number };
  parallelAngle?: number;
}

type Screen = "welcome" | "quiz" | "results";

/* ═══════════════════════ TYPE METADATA ═══════════════════════ */

const TYPE_META: Record<QuestionType, { label: string; icon: React.ReactNode; color: string }> = {
  expression: { label: "Выражения", icon: <Calculator size={16} />, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  diagram_rank: { label: "Диаграмма", icon: <BarChart3 size={16} />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  diagram_pct: { label: "Доля (%)", icon: <PieChart size={16} />, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  unit: { label: "Единицы", icon: <Ruler size={16} />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  logic: { label: "Логика", icon: <Brain size={16} />, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  equation: { label: "Уравнения", icon: <Scale size={16} />, color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  numline: { label: "Числ. прямая", icon: <Minus size={16} />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  grid: { label: "Клетчатка", icon: <Grid3x3 size={16} />, color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  triangle: { label: "Треугольник", icon: <Triangle size={16} />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  graph: { label: "График", icon: <TrendingUp size={16} />, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  algebra: { label: "Алгебра", icon: <Sigma size={16} />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  system: { label: "Система", icon: <GitBranch size={16} />, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  percent: { label: "Проценты", icon: <Percent size={16} />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  parallel: { label: "Углы", icon: <ArrowRightLeft size={16} />, color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  ratio: { label: "Пропорции", icon: <Hash size={16} />, color: "bg-lime-500/20 text-lime-400 border-lime-500/30" },
  heights: { label: "Высоты △", icon: <TriangleAlert size={16} />, color: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30" },
  divisibility: { label: "Делимость", icon: <Hash size={16} />, color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

/* ═══════════════════════ QUESTIONS DATA ═══════════════════════ */

const QUESTIONS: Question[] = [
  {
    id: 1, type: "expression", typeName: "Вычисление выражений",
    text: "Вычислите: (2,5 − 1,2) × 3 + 4,8 ÷ 1,6",
    correctAnswer: "6.9", options: ["5,4", "6,9", "7,2", "8,1"],
    hint: "Сначала выполните действия в скобках, затем умножение и деление слева направо, потом сложение.",
    solution: ["Шаг 1: 2,5 − 1,2 = 1,3", "Шаг 2: 1,3 × 3 = 3,9", "Шаг 3: 4,8 ÷ 1,6 = 3", "Шаг 4: 3,9 + 3 = 6,9"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 2, type: "expression", typeName: "Вычисление выражений",
    text: "Вычислите: (−3)² + 2 × (−4) − 12 ÷ 6",
    correctAnswer: "-1", options: ["−1", "1", "−5", "3"],
    hint: "Степень имеет приоритет, затем умножение и деление, затем сложение и вычитание.",
    solution: ["Шаг 1: (−3)² = 9", "Шаг 2: 2 × (−4) = −8", "Шаг 3: 12 ÷ 6 = 2", "Шаг 4: 9 + (−8) − 2 = 9 − 8 − 2 = −1"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 3, type: "expression", typeName: "Вычисление выражений",
    text: "Вычислите: ²⁄₃ + ⁵⁄₆ − ¹⁄₄",
    correctAnswer: "5/4", options: ["⁷⁄₁₂", "⁵⁄₄", "³⁄₄", "¹¹⁄₁₂"],
    hint: "Приведите все дроби к общему знаменателю. НОК(3, 6, 4) = 12.",
    solution: ["НОК(3, 6, 4) = 12", "²⁄₃ = ⁸⁄₁₂", "⁵⁄₆ = ¹⁰⁄₁₂", "¹⁄₄ = ³⁄₁₂", "⁸⁄₁₂ + ¹⁰⁄₁₂ − ³⁄₁₂ = ¹⁵⁄₁₂ = ⁵⁄₄ = 1¹⁄₄"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 4, type: "diagram_rank", typeName: "Диаграмма — ранжирование",
    text: "На диаграмме показана площадь городов (тыс. км²). Какой город занимает 3-е место по площади?",
    correctAnswer: "Казань",
    options: ["Новосибирск", "Казань", "Екатеринбург", "Самара"],
    hint: "Упорядочите города по высоте столбцов от большего к меньшему.",
    solution: ["По диаграмме: Москва (2562) > СПб (1439) > Казань (614) > Новосибирск (505) > Екатеринбург (491)", "3-е место: Казань"],
    difficulty: 1, answerMode: "choice",
    barData: [
      { label: "Москва", value: 2562, color: "#06b6d4" },
      { label: "СПб", value: 1439, color: "#8b5cf6" },
      { label: "Казань", value: 614, color: "#10b981" },
      { label: "Новосиб.", value: 505, color: "#fbbf24" },
      { label: "Екатеринб.", value: 491, color: "#f43f5e" },
    ],
  },
  {
    id: 5, type: "diagram_pct", typeName: "Диаграмма — доля в %",
    text: "На диаграмме показано население городов (млн чел.). Примерно какой процент населения проживает в Москве?",
    correctAnswer: "~56%", options: ["~30%", "~45%", "~56%", "~70%"],
    hint: "Найдите значение столбца Москвы и разделите на сумму всех значений.",
    solution: ["Москва: 12,6 млн, Сумма: 12,6 + 5,4 + 1,6 + 1,5 + 1,3 = 22,4 млн", "12,6 ÷ 22,4 × 100% ≈ 56%"],
    difficulty: 2, answerMode: "choice",
    barData: [
      { label: "Москва", value: 12.6, color: "#06b6d4" },
      { label: "СПб", value: 5.4, color: "#8b5cf6" },
      { label: "Новосиб.", value: 1.6, color: "#10b981" },
      { label: "Екатеринб.", value: 1.5, color: "#fbbf24" },
      { label: "Казань", value: 1.3, color: "#f43f5e" },
    ],
  },
  {
    id: 6, type: "unit", typeName: "Единицы измерения",
    text: "Переведите: 72 км/ч = ? м/с",
    correctAnswer: "20", options: ["12", "20", "25", "36"],
    hint: "Чтобы перевести км/ч в м/с, разделите на 3,6.",
    solution: ["72 ÷ 3,6 = 20 м/с", "Проверка: 20 × 3,6 = 72 км/ч ✓"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 7, type: "unit", typeName: "Единицы измерения",
    text: "Переведите: 45 минут = ? часов (в виде десятичной дроби)",
    correctAnswer: "0.75", options: ["0,45", "0,75", "0,55", "0,85"],
    hint: "1 час = 60 минут. Разделите 45 на 60.",
    solution: ["45 ÷ 60 = ⁹⁄₁₂ = ³⁄₄ = 0,75"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 8, type: "logic", typeName: "Логика и комбинаторика",
    text: "У Артёма есть 2 рубашки (белая, синяя) и 3 пары штанов (чёрные, серые, коричневые). Сколько различных комплектов он может составить?",
    correctAnswer: "6", options: ["5", "6", "8", "9"],
    hint: "Используйте правило умножения: количество вариантов первого × количество вариантов второго.",
    solution: ["Правило умножения: 2 × 3 = 6", "Каждую из 2 рубашек можно сочетать с каждой из 3 пар штанов"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 9, type: "equation", typeName: "Линейные уравнения",
    text: "Решите уравнение: 7 − 3(5x − 3) = −11x",
    correctAnswer: "x=4", options: ["x = 2", "x = 3", "x = 4", "x = 5"],
    hint: "Раскройте скобки, соберите члены с x в одной стороне, числа — в другой.",
    solution: ["7 − 15x + 9 = −11x", "16 − 15x = −11x", "16 = 4x", "x = 4"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 10, type: "equation", typeName: "Линейные уравнения",
    text: "Решите уравнение: 4(x − 2) + 3 = 5x − 7",
    correctAnswer: "x=2", options: ["x = 1", "x = 2", "x = 3", "x = 4"],
    hint: "Раскройте скобки и перенесите все x влево, числа вправо.",
    solution: ["4x − 8 + 3 = 5x − 7", "4x − 5 = 5x − 7", "−5 + 7 = 5x − 4x", "2 = x"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 11, type: "equation", typeName: "Линейные уравнения",
    text: "Решите уравнение: 2(x + 1) − 3(x − 2) = 5",
    correctAnswer: "x=3", options: ["x = 1", "x = 2", "x = 3", "x = 5"],
    hint: "Раскройте скобки carefully — следите за знаками перед скобками!",
    solution: ["2x + 2 − 3x + 6 = 5", "−x + 8 = 5", "−x = −3", "x = 3"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 12, type: "numline", typeName: "Числовая прямая",
    text: "На числовой прямой отмечена точка A(−²⁄₃). Нажмите на числовую прямую, чтобы отметить эту точку.",
    correctAnswer: "-0.667",
    hint: "−²⁄₃ = −0,666... — это на 2/3 пути от 0 влево к −1.",
    solution: ["Числовой промежуток [−1, 0] делится на 3 равные части", "−²⁄₃ — это вторая отметка слева от 0 (или четвёртая справа от −1)"],
    difficulty: 1, answerMode: "interactive", numberLineTarget: -2 / 3,
  },
  {
    id: 13, type: "grid", typeName: "Расстояние на клетчатке",
    text: "На координатной сетке даны точки A(3, 1), B(1, 1) и C(1, 4). Найдите расстояние от точки A до прямой BC (в единицах сетки).",
    correctAnswer: "2", options: ["1", "2", "3", "4"],
    hint: "Прямая BC — вертикальная (x = 1). Расстояние от A(3,1) до x = 1 — это разница x-координат.",
    solution: ["Прямая BC: B(1,1) и C(1,4) → x = 1 (вертикальная)", "Точка A(3, 1)", "Расстояние = |x_A − x_BC| = |3 − 1| = 2"],
    difficulty: 2, answerMode: "choice",
    gridData: { point: [3, 1], lineStart: [1, 1], lineEnd: [1, 4], gridSize: 5 },
  },
  {
    id: 14, type: "triangle", typeName: "Свойства треугольника",
    text: "В треугольнике ABC два внешних угла равны. Периметр = 78. Одна сторона = 18. Найдите две другие стороны.",
    correctAnswer: "30 и 30", options: ["24 и 36", "30 и 30", "28 и 32", "26 и 34"],
    hint: "Если два внешних угла равны, то два внутренних угла тоже равны → треугольник равнобедренный.",
    solution: ["Два равных внешних угла → два равных внутренних угла → △ равнобедренный", "Пусть AB = AC, BC = 18 (основание)", "AB + BC + AC = 78 → 2AB + 18 = 78", "2AB = 60 → AB = AC = 30"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 15, type: "graph", typeName: "Графики движения",
    text: "На графике показано движение велосипедиста и автомобиля из пункта А. Велосипедист выехал в 9:00 (15 км/ч). Автомобиль выехал в 9:30 (30 км/ч). Через сколько часов после выезда велосипедиста автомобиль его догонит?",
    correctAnswer: "1", options: ["0,5 ч", "1 ч", "1,5 ч", "2 ч"],
    hint: "Найдите точку пересечения двух графиков на диаграмме.",
    solution: ["Велосипедист: S = 15t (км, t в часах от 9:00)", "Автомобиль: S = 30(t − 0,5) = 30t − 15 (начал на 0,5 ч позже)", "15t = 30t − 15 → 15t = 30 → t = 1 час"],
    difficulty: 2, answerMode: "choice",
    graphData: [
      { name: "Велосипедист", points: [[0, 0], [0.5, 7.5], [1, 15], [1.5, 22.5], [2, 30]], color: "#06b6d4" },
      { name: "Автомобиль", points: [[0.5, 0], [1, 15], [1.5, 30], [2, 45]], color: "#f43f5e" },
    ],
  },
  {
    id: 16, type: "algebra", typeName: "Алгебраические выражения",
    text: "Найдите значение выражения a² − b² при a = 3, b = −4. Используйте формулу разности квадратов.",
    correctAnswer: "-7", options: ["7", "−7", "25", "−25"],
    hint: "a² − b² = (a − b)(a + b) — формула разности квадратов.",
    solution: ["a² − b² = (a − b)(a + b)", "a − b = 3 − (−4) = 7", "a + b = 3 + (−4) = −1", "7 × (−1) = −7", "Проверка: 9 − 16 = −7 ✓"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 17, type: "system", typeName: "Системы уравнений",
    text: "Решите систему уравнений:\nx + 2y = −2\n3x − y = 15",
    correctAnswer: "(4;-3)", options: ["(4; −3)", "(−4; 3)", "(3; −4)", "(−3; 4)"],
    hint: "Выразите y из второго уравнения и подставьте в первое.",
    solution: ["Из 2-го: y = 3x − 15", "Подставим в 1-е: x + 2(3x − 15) = −2", "x + 6x − 30 = −2", "7x = 28 → x = 4", "y = 3(4) − 15 = −3", "Ответ: (4; −3)"],
    difficulty: 3, answerMode: "choice",
  },
  {
    id: 18, type: "percent", typeName: "Задачи на проценты",
    text: "Кофеварка уценили на 20% и она стала стоить 4800₽. Какова была первоначальная цена?",
    correctAnswer: "6000", options: ["5400₽", "5760₽", "6000₽", "6200₽"],
    hint: "После уценки на 20% цена составляет 80% от первоначальной.",
    solution: ["Пусть x — исходная цена", "x − 0,2x = 0,8x = 4800", "x = 4800 ÷ 0,8 = 6000₽"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 19, type: "parallel", typeName: "Параллельные прямые и углы",
    text: "Прямые a ∥ b, c — секущая. ∠1 = 118° — накрест лежащий с ∠2. Найдите ∠2.",
    correctAnswer: "118", options: ["62°", "118°", "128°", "180°"],
    hint: "Накрест лежащие углы при параллельных прямых равны.",
    solution: ["Признак: накрест лежащие углы при параллельных прямых и секущей равны", "∠1 = ∠2 = 118°"],
    difficulty: 1, answerMode: "choice", parallelAngle: 118,
  },
  {
    id: 20, type: "ratio", typeName: "Отношения и пропорции",
    text: "В рецепте картофель : говядина : овощи = 3 : 3 : 8. Говядины взяли 720 г. Сколько картофеля и овощей вместе?",
    correctAnswer: "2640", options: ["1920 г", "2400 г", "2640 г", "2880 г"],
    hint: "Найдите, чему равна одна часть, затем вычислите картофель и овощи.",
    solution: ["1 часть = 720 ÷ 3 = 240 г", "Картофель = 3 × 240 = 720 г", "Овощи = 8 × 240 = 1920 г", "Вместе: 720 + 1920 = 2640 г"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 21, type: "divisibility", typeName: "Делимость чисел",
    text: "Найдите последние две цифры трёхзначного числа 82_, если известно, что оно делится на 90.",
    correctAnswer: "80", options: ["70", "80", "90", "60"],
    hint: "90 = 2 × 3² × 5. Число должно делиться на 2, 5 и 9 одновременно.",
    solution: ["90 = 2 × 9 × 5", "Для ÷2 и ÷5: последняя цифра = 0, число = 820", "Сумма цифр 820: 8 + 2 + 0 = 10 — не делится на 9!", "Пробуем 82X0: сумма = 10 + X должна ÷ 9", "X = 8 → 8280, сумма = 18 ÷ 9 ✓", "Последние две цифры: 80"],
    difficulty: 3, answerMode: "choice",
  },
  {
    id: 22, type: "heights", typeName: "Высоты треугольника",
    text: "В треугольнике ABC высоты пересекаются в точке M. ∠BMC = 140°. Найдите ∠BAC.",
    correctAnswer: "40", options: ["30°", "40°", "50°", "60°"],
    hint: "Ортоцентр M: ∠BMC = 180° − ∠A (свойство ортоцентра).",
    solution: ["M — ортоцентр (точка пересечения высот)", "Свойство: ∠BMC = 180° − ∠A", "∠A = 180° − 140° = 40°"],
    difficulty: 3, answerMode: "choice",
  },
  {
    id: 23, type: "expression", typeName: "Вычисление выражений",
    text: "Вычислите: (¹⁄₂ + ¹⁄₃) × 6",
    correctAnswer: "5", options: ["4", "5", "6", "7"],
    hint: "Сложите дроби в скобках, затем умножьте на 6.",
    solution: ["¹⁄₂ + ¹⁄₃ = ³⁄₆ + ²⁄₆ = ⁵⁄₆", "⁵⁄₆ × 6 = 5"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 24, type: "equation", typeName: "Линейные уравнения",
    text: "Решите уравнение: 5 − 2(3x − 1) = 3 − 4x",
    correctAnswer: "x=2", options: ["x = 1", "x = 2", "x = 3", "x = 4"],
    hint: "Не забудьте: −2 умножается на КАЖДЫЙ член в скобках!",
    solution: ["5 − 6x + 2 = 3 − 4x", "7 − 6x = 3 − 4x", "7 − 3 = 6x − 4x", "4 = 2x", "x = 2"],
    difficulty: 2, answerMode: "choice",
  },
  {
    id: 25, type: "percent", typeName: "Задачи на проценты",
    text: "Найдите 15% от числа 240.",
    correctAnswer: "36", options: ["32", "34", "36", "38"],
    hint: "15% = 15/100. Можно также: 10% от 240 + 5% от 240.",
    solution: ["15% = 0,15", "240 × 0,15 = 36", "Или: 10% = 24, 5% = 12, 24 + 12 = 36"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 26, type: "unit", typeName: "Единицы измерения",
    text: "Переведите: 2,5 км = ? м",
    correctAnswer: "2500", options: ["250", "2500", "25000", "25"],
    hint: "1 км = 1000 м. Умножьте 2,5 на 1000.",
    solution: ["2,5 × 1000 = 2500 м"],
    difficulty: 1, answerMode: "choice",
  },
  {
    id: 27, type: "divisibility", typeName: "Делимость чисел",
    text: "Какое из чисел делится на 3?",
    correctAnswer: "135", options: ["124", "135", "142", "157"],
    hint: "Признак делимости на 3: сумма цифр должна делиться на 3.",
    solution: ["124: 1+2+4 = 7 — нет", "135: 1+3+5 = 9 — 9÷3=3 ✓", "142: 1+4+2 = 7 — нет", "157: 1+5+7 = 13 — нет"],
    difficulty: 1, answerMode: "choice",
  },
];

/* ═══════════════════════ REFERENCE DATA ═══════════════════════ */

const REF_FORMULAS = [
  { title: "Разность квадратов", formula: "a² − b² = (a − b)(a + b)", example: "25 − 9 = (5−3)(5+3) = 2×8 = 16" },
  { title: "Квадрат суммы", formula: "(a + b)² = a² + 2ab + b²", example: "(3+2)² = 9 + 12 + 4 = 25" },
  { title: "Квадрат разности", formula: "(a − b)² = a² − 2ab + b²", example: "(5−2)² = 25 − 20 + 4 = 9" },
  { title: "Линейное уравнение", formula: "ax + b = 0 → x = −b/a", example: "3x − 6 = 0 → x = 2" },
  { title: "Сумма углов △", formula: "∠A + ∠B + ∠C = 180°", example: "60° + 70° + 50° = 180°" },
  { title: "Неравенство △", formula: "a + b > c (каждая сторона < суммы двух других)", example: "3 + 4 > 5 ✓" },
];

const REF_DIVISIBILITY = [
  { num: "2", rule: "Число чётное (последняя цифра 0, 2, 4, 6, 8)" },
  { num: "3", rule: "Сумма цифр делится на 3" },
  { num: "4", rule: "Две последние цифры образуют число, делящееся на 4" },
  { num: "5", rule: "Последняя цифра 0 или 5" },
  { num: "6", rule: "Делится на 2 и на 3 одновременно" },
  { num: "9", rule: "Сумма цифр делится на 9" },
  { num: "10", rule: "Последняя цифра 0" },
  { num: "25", rule: "Две последние цифры: 00, 25, 50, 75" },
];

const REF_UNITS = [
  { from: "км/ч → м/с", rule: "÷ 3,6", example: "72 ÷ 3,6 = 20" },
  { from: "м/с → км/ч", rule: "× 3,6", example: "20 × 3,6 = 72" },
  { from: "км → м", rule: "× 1000", example: "2,5 × 1000 = 2500" },
  { from: "кг → г", rule: "× 1000", example: "3 × 1000 = 3000" },
  { from: "т → кг", rule: "× 1000", example: "1,5 × 1000 = 1500" },
  { from: "мин → сек", rule: "× 60", example: "5 × 60 = 300" },
  { from: "ч → мин", rule: "× 60", example: "2 × 60 = 120" },
  { from: "S прямоуг.", rule: "a × b", example: "5 × 3 = 15" },
  { from: "S треуг.", rule: "½ × a × h", example: "½ × 6 × 4 = 12" },
  { from: "S трапеции", rule: "½(a + b) × h", example: "½(3+5)×4 = 16" },
];

const REF_PERCENTS = [
  { title: "% от числа", formula: "n% от A = A × n/100", example: "20% от 300 = 300 × 0,2 = 60" },
  { title: "Число по %", formula: "A = часть × 100/n", example: "60 — это 20% от: 60 × 100/20 = 300" },
  { title: "Увеличение", formula: "A × (1 + n/100)", example: "300 ↑ 20% = 300 × 1,2 = 360" },
  { title: "Уменьшение", formula: "A × (1 − n/100)", example: "300 ↓ 20% = 300 × 0,8 = 240" },
  { title: "Шпаргалка", formula: "10% = ÷10 | 20% = ÷5 | 25% = ÷4 | 50% = ÷2", example: "" },
];

const REF_ANGLES = [
  { title: "Острый", desc: "Меньше 90°", color: "#10b981" },
  { title: "Прямой", desc: "Ровно 90°", color: "#06b6d4" },
  { title: "Тупой", desc: "От 90° до 180°", color: "#fbbf24" },
  { title: "Развёрнутый", desc: "Ровно 180°", color: "#f43f5e" },
  { title: "Соответственные", desc: "При a∥b: ∠1 = ∠2 (равны)", color: "#8b5cf6" },
  { title: "Накрест лежащие", desc: "При a∥b: ∠1 = ∠2 (равны)", color: "#06b6d4" },
  { title: "Односторонние", desc: "При a∥b: ∠1 + ∠2 = 180°", color: "#f43f5e" },
  { title: "Вертикальные", desc: "∠1 = ∠2 (всегда равны)", color: "#10b981" },
];

/* ═══════════════════════ SVG VISUALIZATIONS ═══════════════════════ */

/* — Bar Chart — */
function BarChartSVG({ data, highlightLabel }: { data: Question["barData"]; highlightLabel?: string }) {
  if (!data) return null;
  const maxVal = Math.max(...data.map(d => d.value));
  const barW = 60, gap = 20, totalW = data.length * (barW + gap) - gap;
  const offsetX = 60;
  const chartH = 200, baseY = 230;

  return (
    <svg viewBox={`0 0 ${totalW + offsetX + 40} 270`} className="w-full max-w-lg mx-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="barGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(6,182,212,0.3)" />
          <stop offset="100%" stopColor="rgba(6,182,212,0)" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const h = (d.value / maxVal) * chartH * 0.9;
        const x = offsetX + i * (barW + gap);
        const isHighlight = d.label === highlightLabel;
        return (
          <g key={i}>
            <motion.rect
              x={x} y={baseY - h} width={barW} height={h}
              fill={d.color} rx={4} opacity={0.85}
              initial={{ height: 0, y: baseY }}
              animate={{ height: h, y: baseY - h }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: "easeOut" }}
              className={cn(isHighlight && "outline outline-2 outline-offset-2 outline-amber-400")}
            />
            {isHighlight && (
              <motion.rect x={x - 2} y={baseY - h - 2} width={barW + 4} height={h + 4}
                fill="none" stroke="#fbbf24" strokeWidth={2} rx={5}
                initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1] }}
                transition={{ delay: 1, duration: 1.5, repeat: Infinity }}
              />
            )}
            <text x={x + barW / 2} y={baseY - h - 8} textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="bold">
              {d.value}
            </text>
            <text x={x + barW / 2} y={baseY + 16} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="var(--font-sans)">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={offsetX - 5} y1={baseY} x2={totalW + offsetX + 10} y2={baseY} stroke="#334155" strokeWidth={1} />
    </svg>
  );
}

/* — Number Line (Interactive) — */
function NumberLineSVG({ target, placedValue, onPlace, readOnly }: {
  target?: number; placedValue?: number | null; onPlace?: (v: number) => void; readOnly?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rangeMin = -2, rangeMax = 2;
  const divisions = 6;
  const padX = 40, lineW = 420;
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPlace || readOnly) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = (x - padX) / lineW;
    if (fraction < 0 || fraction > 1) return;
    const value = rangeMin + fraction * (rangeMax - rangeMin);
    const snapped = Math.round(value * divisions) / divisions;
    onPlace(snapped);
  }, [onPlace, readOnly]);

  const marks = [];
  for (let i = 0; i <= divisions * (rangeMax - rangeMin); i++) {
    const val = rangeMin + i / divisions;
    marks.push(val);
  }

  const toX = (v: number) => padX + ((v - rangeMin) / (rangeMax - rangeMin)) * lineW;
  const targetPx = target !== undefined ? toX(target) : null;
  const placedPx = placedValue !== null && placedValue !== undefined ? toX(placedValue) : null;

  return (
    <svg ref={svgRef} viewBox="0 0 500 80" className="w-full max-w-lg mx-auto cursor-pointer" onClick={handleClick} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="dotGlow">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1={padX} y1={35} x2={padX + lineW} y2={35} stroke="#475569" strokeWidth={2} />
      {marks.map((v) => {
        const x = toX(v);
        const isInt = Number.isInteger(v);
        const isThird = Math.abs(v * 3 - Math.round(v * 3)) < 0.01 && !isInt;
        return (
          <g key={v.toString()}>
            <line x1={x} y1={isInt ? 28 : isThird ? 30 : 32} x2={x} y2={isInt ? 42 : isThird ? 40 : 38} stroke="#64748b" strokeWidth={1} />
            {isInt && (
              <text x={x} y={58} textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="bold">{v}</text>
            )}
            {isThird && (
              <text x={x} y={22} textAnchor="middle" fill="#64748b" fontSize="8">
                {v === Math.round(v * 3) / 3 ? (v < 0 ? "−" : "") + Math.abs(Math.round(v * 3)) + "/3" : ""}
              </text>
            )}
          </g>
        );
      })}
      {targetPx !== null && !readOnly && (
        <motion.circle cx={targetPx} cy={35} r={12} fill="url(#dotGlow)" initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} />
      )}
      {placedPx !== null && (
        <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
          <circle cx={placedPx} cy={35} r={14} fill="url(#dotGlow)" />
          <circle cx={placedPx} cy={35} r={6} fill="#06b6d4" stroke="#0a0a1a" strokeWidth={2} />
          <text x={placedPx} y={72} textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="bold">
            {placedValue !== null && placedValue !== undefined ? (placedValue < 0 ? "−" : "") + (Math.abs(placedValue) % 1 === 0 ? Math.abs(placedValue).toString() : (Math.round(Math.abs(placedValue) * 3) + "/3")) : ""}
          </text>
        </motion.g>
      )}
    </svg>
  );
}

/* — Motion Graph — */
function MotionGraphSVG({ data }: { data: Question["graphData"] }) {
  if (!data) return null;
  const padL = 50, padB = 45, padT = 20, padR = 20;
  const w = 460, h = 260;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const maxT = 2.5, maxD = 50;
  const toX = (t: number) => padL + (t / maxT) * plotW;
  const toY = (d: number) => padT + plotH - (d / maxD) * plotH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-lg mx-auto" preserveAspectRatio="xMidYMid meet">
      <rect x={padL} y={padT} width={plotW} height={plotH} fill="rgba(6,182,212,0.03)" rx={4} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
      {[0, 0.5, 1, 1.5, 2].map(t => (
        <g key={`t${t}`}>
          <line x1={toX(t)} y1={padT + plotH} x2={toX(t)} y2={padT + plotH + 5} stroke="#475569" strokeWidth={1} />
          <text x={toX(t)} y={padT + plotH + 18} textAnchor="middle" fill="#94a3b8" fontSize="10">{t}ч</text>
        </g>
      ))}
      {[0, 10, 20, 30, 40, 50].map(d => (
        <g key={`d${d}`}>
          <line x1={padL - 5} y1={toY(d)} x2={padL} y2={toY(d)} stroke="#475569" strokeWidth={1} />
          <text x={padL - 8} y={toY(d) + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{d}</text>
        </g>
      ))}
      <text x={padL + plotW / 2} y={h - 2} textAnchor="middle" fill="#94a3b8" fontSize="10">Время</text>
      <text x={10} y={padT + plotH / 2} textAnchor="middle" fill="#94a3b8" fontSize="10" transform={`rotate(-90, 10, ${padT + plotH / 2})`}>Расстояние (км)</text>

      {data.map((ds, di) => {
        const pts = ds.points;
        const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p[0])},${toY(p[1])}`).join(" ");
        return (
          <g key={di}>
            <motion.path d={pathD} fill="none" stroke={ds.color} strokeWidth={2.5}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ delay: 0.5 + di * 0.3, duration: 1 }} />
            {pts.map((p, pi) => (
              <motion.circle key={pi} cx={toX(p[0])} cy={toY(p[1])} r={3} fill={ds.color}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.5 + di * 0.3 + pi * 0.15 }} />
            ))}
          </g>
        );
      })}

      {data.length >= 2 && (() => {
        const [a, b] = data;
        for (const pa of a.points) {
          for (const pb of b.points) {
            if (Math.abs(pa[0] - pb[0]) < 0.05 && Math.abs(pa[1] - pb[1]) < 1) {
              return (
                <motion.g key="meet" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: "spring" }}>
                  <circle cx={toX(pa[0])} cy={toY(pa[1])} r={10} fill="none" stroke="#fbbf24" strokeWidth={2} />
                  <circle cx={toX(pa[0])} cy={toY(pa[1])} r={4} fill="#fbbf24" />
                  <text x={toX(pa[0]) + 14} y={toY(pa[1]) - 8} fill="#fbbf24" fontSize="10" fontWeight="bold">Встреча</text>
                </motion.g>
              );
            }
          }
        }
        return null;
      })()}

      <g transform={`translate(${w - padR - 10}, ${padT + 10})`}>
        {data.map((ds, i) => (
          <g key={i} transform={`translate(0, ${i * 16})`}>
            <line x1={-20} y1={0} x2={0} y2={0} stroke={ds.color} strokeWidth={2} />
            <text x={5} y={4} fill={ds.color} fontSize="9">{ds.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* — Grid Distance — */
function GridDistanceSVG({ gd }: { gd: Question["gridData"] }) {
  if (!gd) return null;
  const { point: [ax, ay], lineStart: [bx, by], lineEnd: [cx, cy], gridSize } = gd;
  const cellSize = 50, pad = 25, svgW = gridSize * cellSize + pad * 2, svgH = gridSize * cellSize + pad * 2;
  const toSvg = (gx: number, gy: number) => [pad + (gx - 0.5) * cellSize, pad + (gridSize - gy - 0.5) * cellSize];
  const [sax, say] = toSvg(ax, ay);
  const [sbx, sby] = toSvg(bx, by);
  const [scx, scy] = toSvg(cx, cy);

  const dist = Math.abs(ax - bx);
  const perpX = sax;
  const perpY1 = say;
  const perpY2 = sby;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-xs mx-auto" preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: gridSize + 1 }).map((_, i) => (
        <g key={`grid${i}`}>
          <line x1={pad} y1={pad + i * cellSize} x2={pad + gridSize * cellSize} y2={pad + i * cellSize} stroke="#1e293b" strokeWidth={0.5} />
          <line x1={pad + i * cellSize} y1={pad} x2={pad + i * cellSize} y2={pad + gridSize * cellSize} stroke="#1e293b" strokeWidth={0.5} />
        </g>
      ))}
      <motion.line x1={sbx} y1={sby} x2={scx} y2={scy} stroke="#8b5cf6" strokeWidth={2.5}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
      <motion.line x1={perpX} y1={perpY1} x2={perpX} y2={perpY2} stroke="#f43f5e" strokeWidth={2} strokeDasharray="6,3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.5 }} />
      <motion.circle cx={sax} cy={say} r={6} fill="#06b6d4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} />
      <motion.circle cx={sbx} cy={sby} r={6} fill="#8b5cf6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }} />
      <motion.circle cx={scx} cy={scy} r={6} fill="#8b5cf6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }} />
      <text x={sax + 10} y={say - 10} fill="#06b6d4" fontSize="12" fontWeight="bold">A({ax},{ay})</text>
      <text x={sbx + 10} y={sby - 10} fill="#8b5cf6" fontSize="12" fontWeight="bold">B({bx},{by})</text>
      <text x={scx + 10} y={scy + 20} fill="#8b5cf6" fontSize="12" fontWeight="bold">C({cx},{cy})</text>
      {dist > 0 && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
          <text x={perpX + 8} y={(perpY1 + perpY2) / 2 + 4} fill="#f43f5e" fontSize="11" fontWeight="bold">{dist}</text>
        </motion.g>
      )}
    </svg>
  );
}

/* — Parallel Lines — */
function ParallelLinesSVG({ angle }: { angle?: number }) {
  const deg = angle ?? 118;
  const comp = 180 - deg;
  return (
    <svg viewBox="0 0 400 220" className="w-full max-w-md mx-auto" preserveAspectRatio="xMidYMid meet">
      <motion.line x1={30} y1={60} x2={370} y2={60} stroke="#06b6d4" strokeWidth={2}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
      <motion.line x1={30} y1={160} x2={370} y2={160} stroke="#06b6d4" strokeWidth={2}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />
      <text x={375} y={58} fill="#06b6d4" fontSize="12" fontWeight="bold">a</text>
      <text x={375} y={158} fill="#06b6d4" fontSize="12" fontWeight="bold">b</text>
      <motion.line x1={200} y1={30} x2={140} y2={190} stroke="#fbbf24" strokeWidth={2}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.4 }} />
      <text x={130} y={200} fill="#fbbf24" fontSize="12" fontWeight="bold">c</text>
      <text x={45} y={52} fill="#94a3b8" fontSize="10">a ∥ b</text>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        <path d={`M ${200 + 25 * Math.cos((-deg * Math.PI / 180))} ${60 + 25 * Math.sin((-deg * Math.PI / 180))} A 25 25 0 0 1 ${200 + 25 * Math.cos((-180 * Math.PI / 180))} ${60 + 25 * Math.sin((-180 * Math.PI / 180))}`} fill="rgba(6,182,212,0.15)" stroke="#06b6d4" strokeWidth={1.5} />
        <text x={215} y={72} fill="#06b6d4" fontSize="12" fontWeight="bold">∠1 = {deg}°</text>
      </motion.g>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
        <path d={`M ${140 + 25 * Math.cos((-comp * Math.PI / 180))} ${160 + 25 * Math.sin((-comp * Math.PI / 180))} A 25 25 0 0 1 ${140 + 25 * Math.cos((0 * Math.PI / 180))} ${160 + 25 * Math.sin((0 * Math.PI / 180))}`} fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth={1.5} />
        <text x={148} y={178} fill="#8b5cf6" fontSize="12" fontWeight="bold">∠2 = ?</text>
      </motion.g>
    </svg>
  );
}

/* — Formula Steps — */
function FormulaSteps({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-2 my-3">
      {steps.map((step, i) => {
        const isResult = i === steps.length - 1;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.25, duration: 0.3 }}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-sm",
              isResult ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold" : "bg-slate-800/50 text-slate-300"
            )}
          >
            {i < steps.length - 1 && (
              <span className="text-cyan-400 text-xs font-mono shrink-0 w-6 text-center">{i + 1}.</span>
            )}
            {isResult && <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />}
            <span className="font-mono">{step}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* — Triangle SVG (for heights/properties) — */
function TriangleSVG({ showHeights }: { showHeights?: boolean }) {
  const vA = [150, 30], vB = [50, 200], vC = [280, 200];
  const labelA = [148, 22], labelB = [30, 210], labelC = [288, 210];

  const hLine1x = vA[0], hLine1y1 = vA[1], hLine1y2 = ((vC[0] - vB[0]) * (vA[1] - vB[1]) / (vC[1] - vB[1]) + vB[0] === undefined) ? vA[1] : (() => {
    const dx = vC[0] - vB[0], dy = vC[1] - vB[1];
    const t = ((vA[0] - vB[0]) * dx + (vA[1] - vB[1]) * dy) / (dx * dx + dy * dy);
    return vB[1] + t * dy;
  })();
  const footOnBC = (() => {
    const dx = vC[0] - vB[0], dy = vC[1] - vB[1];
    const t = ((vA[0] - vB[0]) * dx + (vA[1] - vB[1]) * dy) / (dx * dx + dy * dy);
    return [vB[0] + t * dx, vB[1] + t * dy];
  })();
  const orthoCenter = showHeights ? (() => {
    const footOnAC = (() => {
      const dx = vC[0] - vA[0], dy = vC[1] - vA[1];
      const t = ((vB[0] - vA[0]) * dx + (vB[1] - vA[1]) * dy) / (dx * dx + dy * dy);
      return [vA[0] + t * dx, vA[1] + t * dy];
    })();
    const dx1 = footOnBC[0] - vA[0], dy1 = footOnBC[1] - vA[1];
    const dx2 = footOnAC[0] - vB[0], dy2 = footOnAC[1] - vB[1];
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 0.001) return [(vA[0] + vB[0] + vC[0]) / 3, (vA[1] + vB[1] + vC[1]) / 3];
    const t = ((vB[0] - vA[0]) * dy2 - (vB[1] - vA[1]) * dx2) / det;
    return [vA[0] + t * dx1, vA[1] + t * dy1];
  })() : null;

  return (
    <svg viewBox="0 0 340 240" className="w-full max-w-xs mx-auto" preserveAspectRatio="xMidYMid meet">
      <motion.polygon points={`${vA[0]},${vA[1]} ${vB[0]},${vB[1]} ${vC[0]},${vC[1]}`}
        fill="rgba(6,182,212,0.08)" stroke="#06b6d4" strokeWidth={2}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      {showHeights && footOnBC && (
        <>
          <motion.line x1={vA[0]} y1={vA[1]} x2={footOnBC[0]} y2={footOnBC[1]}
            stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="4,3"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6 }} />
          <motion.circle cx={footOnBC[0]} cy={footOnBC[1]} r={3} fill="#f43f5e"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }} />
          {orthoCenter && (
            <>
              <motion.circle cx={orthoCenter[0]} cy={orthoCenter[1]} r={5} fill="#fbbf24"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 }} />
              <text x={orthoCenter[0] + 8} y={orthoCenter[1] - 6} fill="#fbbf24" fontSize="11" fontWeight="bold">M</text>
            </>
          )}
        </>
      )}
      <motion.circle cx={vA[0]} cy={vA[1]} r={5} fill="#06b6d4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} />
      <motion.circle cx={vB[0]} cy={vB[1]} r={5} fill="#06b6d4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} />
      <motion.circle cx={vC[0]} cy={vC[1]} r={5} fill="#06b6d4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }} />
      <text x={labelA[0]} y={labelA[1]} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold">A</text>
      <text x={labelB[0]} y={labelB[1]} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold">B</text>
      <text x={labelC[0]} y={labelC[1]} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold">C</text>
    </svg>
  );
}

/* ═══════════════════════ UI COMPONENTS ═══════════════════════ */

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const meta = TYPE_META[type];
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-medium", meta.color)}>
      {meta.icon}
      {meta.label}
    </Badge>
  );
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3].map(i => (
        <div key={i} className={cn("w-2 h-2 rounded-full", i <= level ? "bg-amber-400" : "bg-slate-700")} />
      ))}
    </div>
  );
}

function Confetti() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }).map((_, i) => ({
      x: Math.cos((i * 20) * Math.PI / 180) * (40 + (i % 4) * 25),
      y: Math.sin((i * 20) * Math.PI / 180) * (40 + (i % 4) * 25),
      color: ["#06b6d4", "#8b5cf6", "#10b981", "#fbbf24", "#f43f5e"][i % 5],
      delay: i * 0.025,
      size: 4 + (i % 3) * 2,
    })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p, i) => (
        <motion.div key={i} className="absolute rounded-full left-1/2 top-1/2"
          style={{ backgroundColor: p.color, width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
          transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }} />
      ))}
    </div>
  );
}

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/,/g, ".").replace(/\u2212/g, "-").replace(/\s/g, "").replace(/[₽%°]/g, "");
}

function checkAnswer(userAns: string, correctAns: string): boolean {
  const u = normalizeAnswer(userAns);
  const c = normalizeAnswer(correctAns);
  if (u === c) return true;
  const uNum = parseFloat(u);
  const cNum = parseFloat(c);
  if (!isNaN(uNum) && !isNaN(cNum) && Math.abs(uNum - cNum) < 0.05) return true;
  const uFrac = u.split("/");
  const cFrac = c.split("/");
  if (uFrac.length === 2 && cFrac.length === 2) {
    const uv = parseFloat(uFrac[0]), ud = parseFloat(uFrac[1]);
    const cv = parseFloat(cFrac[0]), cd = parseFloat(cFrac[1]);
    if (!isNaN(uv) && !isNaN(ud) && ud !== 0 && !isNaN(cv) && !isNaN(cd) && cd !== 0) {
      if (Math.abs(uv / ud - cv / cd) < 0.01) return true;
    }
  }
  if (uFrac.length === 2) {
    const uv = parseFloat(uFrac[0]), ud = parseFloat(uFrac[1]);
    if (!isNaN(uv) && !isNaN(ud) && ud !== 0 && !isNaN(cNum) && Math.abs(uv / ud - cNum) < 0.01) return true;
  }
  if (cFrac.length === 2) {
    const cv = parseFloat(cFrac[0]), cd = parseFloat(cFrac[1]);
    if (!isNaN(cv) && !isNaN(cd) && cd !== 0 && !isNaN(uNum) && Math.abs(uNum - cv / cd) < 0.01) return true;
  }
  return false;
}

/* ═══════════════════════ WELCOME SCREEN ═══════════════════════ */

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const stats = [
    { icon: <Target size={20} />, label: "27 вопросов", color: "text-cyan-400" },
    { icon: <BookOpen size={20} />, label: "17 типов заданий", color: "text-violet-400" },
    { icon: <Sparkles size={20} />, label: "Пошаговые решения", color: "text-amber-400" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center mb-8">
        <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-cyan-400 via-violet-500 to-cyan-400 bg-clip-text text-transparent leading-tight tracking-tight">
          МАТЕРИЯ
        </h1>
        <motion.p className="mt-3 text-lg md:text-xl text-slate-400 font-medium"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          Алгебра 7 класс — интерактивный тренажёр ВПР
        </motion.p>
      </motion.div>

      <motion.div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-10"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        {stats.map((s, i) => (
          <motion.div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50"
            whileHover={{ scale: 1.05, borderColor: "rgba(6,182,212,0.4)" }}>
            <span className={s.color}>{s.icon}</span>
            <span className="text-sm text-slate-300">{s.label}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="flex gap-4 mb-10 flex-wrap justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 w-36 h-28 flex items-center justify-center">
          <NumberLineSVG target={-0.667} placedValue={-0.667} readOnly />
        </div>
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 w-36 h-28 flex items-center justify-center">
          <TriangleSVG />
        </div>
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 w-36 h-28 flex items-center justify-center overflow-hidden">
          <svg viewBox="0 0 200 80" className="w-full">
            <motion.text x="10" y="25" fill="#94a3b8" fontSize="11" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>7 − 15x + 9 = −11x</motion.text>
            <motion.text x="10" y="42" fill="#06b6d4" fontSize="11" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>16 = 4x</motion.text>
            <motion.text x="10" y="59" fill="#10b981" fontSize="13" fontWeight="bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>x = 4 ✓</motion.text>
            <motion.line x1="10" y1="29" x2="160" y2="29" stroke="#334155" strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
            <motion.line x1="10" y1="46" x2="160" y2="46" stroke="#334155" strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} />
          </svg>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 }}>
        <Button size="lg" onClick={onStart}
          className="text-lg px-8 py-6 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300 cursor-pointer">
          <Play size={20} className="mr-2" />
          Начать тренировку
          <ArrowRight size={18} className="ml-2" />
        </Button>
      </motion.div>

      <motion.div className="mt-8 flex items-center gap-2 text-slate-500 text-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
        <GraduationCap size={16} />
        Подготовка к ВПР 2025
      </motion.div>
    </div>
  );
}

/* ═══════════════════════ REFERENCE SIDEBAR ═══════════════════════ */

function ReferenceSidebar({ activeTab, currentType }: { activeTab: string; currentType?: QuestionType }) {
  const [selectedTab, setSelectedTab] = useState(activeTab);
  // Sync to the auto-selected tab when question type changes
  useEffect(() => { setSelectedTab(activeTab); }, [activeTab]);

  const refItems: Record<string, React.ReactNode> = {
    formulas: (
      <div className="space-y-3 p-3">
        {REF_FORMULAS.map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
            <div className="text-xs text-cyan-400 font-medium mb-1">{f.title}</div>
            <div className="font-mono text-sm text-amber-300 mb-1">{f.formula}</div>
            <div className="text-xs text-slate-400">{f.example}</div>
          </motion.div>
        ))}
      </div>
    ),
    divisibility: (
      <div className="space-y-3 p-3">
        {REF_DIVISIBILITY.map((d, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex gap-3 p-2 rounded-lg bg-slate-800/50">
            <Badge variant="outline" className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-sm px-2.5 py-0.5 shrink-0">{d.num}</Badge>
            <span className="text-sm text-slate-300">{d.rule}</span>
          </motion.div>
        ))}
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 mt-2">
          <div className="text-xs text-cyan-400 font-medium mb-1">Простые числа до 50</div>
          <div className="font-mono text-xs text-amber-300">2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47</div>
        </div>
      </div>
    ),
    units: (
      <div className="space-y-2 p-3">
        {REF_UNITS.map((u, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
            <span className="text-sm text-slate-300 font-mono">{u.from}</span>
            <span className="text-xs text-cyan-400 font-medium">{u.rule}</span>
          </motion.div>
        ))}
      </div>
    ),
    percents: (
      <div className="space-y-3 p-3">
        {REF_PERCENTS.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
            <div className="text-xs text-cyan-400 font-medium mb-1">{p.title}</div>
            <div className="font-mono text-sm text-amber-300 mb-1">{p.formula}</div>
            {p.example && <div className="text-xs text-slate-400">{p.example}</div>}
          </motion.div>
        ))}
      </div>
    ),
    angles: (
      <div className="space-y-3 p-3">
        {REF_ANGLES.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
            <div>
              <div className="text-sm font-medium text-slate-200">{a.title}</div>
              <div className="text-xs text-slate-400">{a.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  };

  const tabToType: Record<string, QuestionType[]> = {
    formulas: ["equation", "algebra", "system", "expression"],
    divisibility: ["divisibility"],
    units: ["unit"],
    percents: ["percent"],
    angles: ["parallel", "triangle", "heights"],
  };
  const isRelevant = currentType ? (tabToType[selectedTab]?.includes(currentType) ?? false) : false;

  return (
    <Card className="border-slate-700/50 bg-card/80 backdrop-blur h-fit">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookMarked size={16} className="text-cyan-400" />
          Справочник
        </CardTitle>
      </CardHeader>
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="w-full bg-slate-800/50 h-auto flex-wrap gap-1 p-1 rounded-lg">
          {[
            { val: "formulas", icon: <Sigma size={12} />, label: "Формулы" },
            { val: "divisibility", icon: <Hash size={12} />, label: "Делим." },
            { val: "units", icon: <Ruler size={12} />, label: "Ед." },
            { val: "percents", icon: <Percent size={12} />, label: "%" },
            { val: "angles", icon: <Triangle size={12} />, label: "Углы" },
          ].map(t => (
            <TabsTrigger key={t.val} value={t.val}
              className={cn("text-xs px-2 py-1 data-[state=active]:bg-cyan-600/30 data-[state=active]:text-cyan-400",
                isRelevant && t.val === selectedTab && "ring-1 ring-cyan-400/50")}>
              <span className="flex items-center gap-1">{t.icon} {t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollArea className="max-h-[60vh]">
          {Object.entries(refItems).map(([key, content]) => (
            <TabsContent key={key} value={key} className="mt-0">
              {content}
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
      {isRelevant && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pb-3">
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
            <Zap size={10} className="mr-1" /> Рекомендуется для этого вопроса
          </Badge>
        </motion.div>
      )}
    </Card>
  );
}

/* ═══════════════════════ QUIZ MODE ═══════════════════════ */

function QuizQuestion({ question, answers, onAnswer, onNavigate, totalQuestions, currentIndex, sidebarOpen, setSidebarOpen, activeRefTab }: {
  question: Question;
  answers: Record<number, { userAnswer: string; correct: boolean }>;
  onAnswer: (answer: string, correct: boolean) => void;
  onNavigate: (dir: number) => void;
  totalQuestions: number;
  currentIndex: number;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activeRefTab: string;
}) {
  const [inputVal, setInputVal] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [placedValue, setPlacedValue] = useState<number | null>(null);
  const prevQ = answers[question.id];

  const handleSubmit = useCallback(() => {
    if (prevQ) return;
    let userAns = "";
    if (question.answerMode === "choice") {
      return;
    } else if (question.answerMode === "input") {
      userAns = inputVal;
    } else if (question.answerMode === "interactive" && placedValue !== null) {
      userAns = placedValue.toFixed(3);
    }
    if (!userAns) return;
    const isCorrect = checkAnswer(userAns, question.correctAnswer);
    onAnswer(userAns, isCorrect);
    setShowSolution(true);
  }, [question, inputVal, placedValue, prevQ, onAnswer]);

  const handleChoice = useCallback((option: string) => {
    if (prevQ) return;
    const isCorrect = checkAnswer(option, question.correctAnswer);
    onAnswer(option, isCorrect);
    setShowSolution(true);
  }, [question, prevQ, onAnswer]);

  const isAnswered = !!prevQ;
  const isCorrect = prevQ?.correct ?? false;

  const typeToRefTab: Partial<Record<QuestionType, string>> = {
    expression: "formulas", equation: "formulas", algebra: "formulas", system: "formulas",
    divisibility: "divisibility", unit: "units", percent: "percents",
    parallel: "angles", triangle: "angles", heights: "angles",
  };
  const relevantTab = typeToRefTab[question.type] ?? "formulas";

  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full max-w-6xl mx-auto">
      {/* Floating sidebar toggle */}
      <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 z-50 bg-cyan-600/80 hover:bg-cyan-500/80 text-white border border-cyan-400/30 backdrop-blur shadow-lg shadow-cyan-500/20 rounded-full w-12 h-12 p-0 cursor-pointer">
        <BookOpen size={20} />
      </Button>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Вопрос {currentIndex + 1} из {totalQuestions}</span>
            <div className="flex items-center gap-3">
              <DifficultyDots level={question.difficulty} />
              <QuestionTypeBadge type={question.type} />
            </div>
          </div>
          <Progress value={progress} className="h-2 bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-500" />
        </div>

        {/* Question Card */}
        <motion.div key={question.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }} layout>
          <Card className="border-slate-700/50 bg-card/80 backdrop-blur relative overflow-hidden">
            {isAnswered && isCorrect && <Confetti />}
            <CardContent className="p-5 md:p-7">
              {/* Question text */}
              <div className="flex items-start gap-3 mb-5">
                <Badge className="bg-gradient-to-r from-cyan-600 to-violet-600 text-white border-0 text-sm px-3 py-1 shrink-0">
                  {question.id}
                </Badge>
                <p className="text-base md:text-lg text-slate-100 font-medium leading-relaxed">{question.text}</p>
              </div>

              {/* Visualization */}
              {question.barData && <BarChartSVG data={question.barData} />}
              {question.numberLineTarget !== undefined && (
                <NumberLineSVG target={question.numberLineTarget} placedValue={placedValue}
                  onPlace={isAnswered ? undefined : setPlacedValue} readOnly={isAnswered} />
              )}
              {question.graphData && <MotionGraphSVG data={question.graphData} />}
              {question.gridData && <GridDistanceSVG gd={question.gridData} />}
              {question.parallelAngle !== undefined && <ParallelLinesSVG angle={question.parallelAngle} />}
              {question.type === "triangle" && <TriangleSVG />}
              {question.type === "heights" && <TriangleSVG showHeights />}

              {/* Answer area */}
              <div className="mt-5">
                {!isAnswered ? (
                  <div className="space-y-3">
                    {question.answerMode === "choice" && question.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {question.options.map((opt, i) => (
                          <motion.button key={i} onClick={() => handleChoice(opt)}
                            className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-left text-sm text-slate-200 hover:bg-cyan-900/30 hover:border-cyan-500/40 transition-all cursor-pointer"
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <span className="text-slate-500 mr-2 font-mono">{String.fromCharCode(65 + i)}.</span>
                            {opt}
                          </motion.button>
                        ))}
                      </div>
                    )}
                    {question.answerMode === "input" && (
                      <div className="flex gap-2">
                        <Input value={inputVal} onChange={e => setInputVal(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleSubmit()}
                          placeholder="Введите ответ..." className="bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder:text-slate-500 flex-1"
                        />
                        <Button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer">Проверить</Button>
                      </div>
                    )}
                    {question.answerMode === "interactive" && (
                      <div className="text-center">
                        <p className="text-sm text-slate-400 mb-2">Нажмите на числовую прямую, чтобы отметить точку</p>
                        {placedValue !== null && (
                          <Button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer">
                            Проверить ({placedValue < 0 ? "−" : ""}{(Math.abs(placedValue) * 3 % 1 === 0) ? Math.abs(placedValue) : placedValue.toFixed(3)})
                          </Button>
                        )}
                      </div>
                    )}
                    {/* Hint button */}
                    {!showHint && (
                      <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}
                        className="text-slate-400 hover:text-amber-400 cursor-pointer">
                        <Lightbulb size={14} className="mr-1" /> Показать подсказку
                      </Button>
                    )}
                    {showHint && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                        <Lightbulb size={14} className="inline mr-1" /> {question.hint}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {/* Feedback */}
                    <div className={cn(
                      "p-4 rounded-xl mb-4 border relative",
                      isCorrect ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        {isCorrect ? (
                          <>
                            <CheckCircle2 size={20} className="text-emerald-400" />
                            <span className="font-bold text-emerald-400">Правильно!</span>
                            <Star size={16} className="text-amber-400" />
                          </>
                        ) : (
                          <motion.div animate={{ x: [0, -8, 8, -8, 8, 0] }} transition={{ duration: 0.5 }}>
                            <div className="flex items-center gap-2">
                              <XCircle size={20} className="text-rose-400" />
                              <span className="font-bold text-rose-400">Не совсем</span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      {!isCorrect && prevQ && (
                        <p className="text-sm text-slate-300 mt-2">
                          Ваш ответ: <span className="text-rose-400 font-mono">{prevQ.userAnswer}</span>{" "}
                          | Правильный: <span className="text-emerald-400 font-mono">{question.correctAnswer}</span>
                        </p>
                      )}
                    </div>

                    {/* Solution */}
                    <div className="mb-4">
                      <Button variant="ghost" size="sm" onClick={() => setShowSolution(!showSolution)}
                        className="text-cyan-400 hover:text-cyan-300 cursor-pointer">
                        {showSolution ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                        {showSolution ? "Скрыть решение" : "Показать решение"}
                      </Button>
                      {showSolution && <FormulaSteps steps={question.solution} />}
                    </div>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" onClick={() => onNavigate(-1)} disabled={currentIndex === 0}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer">
            <ChevronLeft size={16} /> Назад
          </Button>
          <div className="hidden sm:flex gap-1">
            {QUESTIONS.map((_, i) => {
              const a = answers[QUESTIONS[i].id];
              return (
                <button key={i} onClick={() => onNavigate(i - currentIndex)}
                  className={cn("w-2.5 h-2.5 rounded-full transition-all cursor-pointer",
                    i === currentIndex ? "bg-cyan-400 scale-125" :
                    a?.correct ? "bg-emerald-500" :
                    a && !a.correct ? "bg-rose-500" : "bg-slate-700 hover:bg-slate-600"
                  )} />
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate(1)} disabled={currentIndex === totalQuestions - 1}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer">
            Далее <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Sidebar overlay (all screens, toggle via floating button) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#0a0a1a] p-4 overflow-y-auto">
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}
                className="absolute top-2 right-2 text-slate-400 cursor-pointer">
                <X size={18} />
              </Button>
              <div className="mt-8">
                <ReferenceSidebar activeTab={activeRefTab} currentType={question.type} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════ RESULTS SCREEN ═══════════════════════ */

function ResultsScreen({ answers, onRetry }: { answers: Record<number, { userAnswer: string; correct: boolean }>; onRetry: () => void }) {
  const totalQ = QUESTIONS.length;
  const correctCount = Object.values(answers).filter(a => a.correct).length;
  const answeredCount = Object.keys(answers).length;
  const pct = answeredCount > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

  const grade = pct >= 90 ? { text: "Отлично!", color: "text-emerald-400", emoji: "🏆", desc: "Ты готов к ВПР на 100%!" }
    : pct >= 70 ? { text: "Хорошо!", color: "text-cyan-400", emoji: "⭐", desc: "Неплохо, но есть куда расти" }
    : pct >= 50 ? { text: "Удовлетворительно", color: "text-amber-400", emoji: "📚", desc: "Нужно ещё потренироваться" }
    : { text: "Нужно подтянуть", color: "text-rose-400", emoji: "💪", desc: "Не сдавайся! Повтори теорию и попробуй снова" };

  const wrongAnswers = QUESTIONS.filter(q => answers[q.id] && !answers[q.id].correct);

  const typeBreakdown = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {};
    QUESTIONS.forEach(q => {
      if (!map[q.type]) map[q.type] = { total: 0, correct: 0 };
      map[q.type].total++;
      if (answers[q.id]?.correct) map[q.type].correct++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [answers]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <div className="text-5xl mb-3">{grade.emoji}</div>
        <h2 className="text-3xl font-black mb-2">
          <span className={grade.color}>{grade.text}</span>
        </h2>
        <p className="text-slate-400">{grade.desc}</p>
      </motion.div>

      {/* Score */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
        className="flex justify-center mb-8">
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="8" />
            <motion.circle cx="60" cy="60" r="52" fill="none" stroke={pct >= 70 ? "#06b6d4" : pct >= 50 ? "#fbbf24" : "#f43f5e"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - pct / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="text-4xl font-black text-slate-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              {pct}%
            </motion.span>
            <span className="text-xs text-slate-400">{correctCount}/{totalQ}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Правильных", value: correctCount, color: "text-emerald-400" },
          { label: "Ошибок", value: wrongAnswers.length, color: "text-rose-400" },
          { label: "Без ответа", value: totalQ - answeredCount, color: "text-slate-400" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
            className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Type breakdown */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-8">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-cyan-400" /> Результаты по типам
        </h3>
        <div className="space-y-2">
          {typeBreakdown.map(([type, { total, correct }], i) => {
            const pctType = total > 0 ? Math.round((correct / total) * 100) : 0;
            const meta = TYPE_META[type as QuestionType];
            return (
              <motion.div key={type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30">
                <div className="w-32 shrink-0 flex items-center gap-1.5">
                  <span className={cn("text-xs", meta?.color.includes("text-") ? meta.color.split(" ").find(c => c.startsWith("text-")) : "text-slate-400")}>
                    {meta?.label ?? type}
                  </span>
                </div>
                <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div className={cn("h-full rounded-full", pctType >= 70 ? "bg-emerald-500" : pctType >= 50 ? "bg-amber-500" : "bg-rose-500")}
                    initial={{ width: 0 }} animate={{ width: `${pctType}%` }} transition={{ delay: 0.8 + i * 0.05, duration: 0.5 }} />
                </div>
                <span className="text-xs text-slate-400 w-16 text-right">{correct}/{total}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Wrong answers */}
      {wrongAnswers.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mb-8">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <XCircle size={16} className="text-rose-400" /> Разбор ошибок
          </h3>
          <div className="space-y-3">
            {wrongAnswers.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 + i * 0.1 }}
                className="p-4 rounded-xl bg-slate-800/50 border border-rose-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">{q.id}</Badge>
                  <QuestionTypeBadge type={q.type} />
                </div>
                <p className="text-sm text-slate-200 mb-2">{q.text}</p>
                <p className="text-xs text-slate-400">
                  Ваш ответ: <span className="text-rose-400 font-mono">{answers[q.id]?.userAnswer}</span> →
                  Правильный: <span className="text-emerald-400 font-mono">{q.correctAnswer}</span>
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300">Показать решение</summary>
                  <FormulaSteps steps={q.solution} />
                </details>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Retry button */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }} className="text-center">
        <Button size="lg" onClick={onRetry}
          className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-5 rounded-xl cursor-pointer">
          <RotateCcw size={18} className="mr-2" />
          Пройти снова
        </Button>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════ MAIN APP ═══════════════════════ */

function MathPractice() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { userAnswer: string; correct: boolean }>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const typeToRefTab: Partial<Record<QuestionType, string>> = {
    expression: "formulas", equation: "formulas", algebra: "formulas", system: "formulas",
    divisibility: "divisibility", unit: "units", percent: "percents",
    parallel: "angles", triangle: "angles", heights: "angles",
  };
  const activeRefTab = typeToRefTab[QUESTIONS[currentIndex]?.type] ?? "formulas";

  const handleStart = useCallback(() => {
    setScreen("quiz");
    setCurrentIndex(0);
    setAnswers({});
  }, []);

  const handleAnswer = useCallback((qId: number, userAnswer: string, correct: boolean) => {
    setAnswers(prev => ({ ...prev, [qId]: { userAnswer, correct } }));
  }, []);

  const handleNavigate = useCallback((dir: number) => {
    const newIdx = Math.max(0, Math.min(QUESTIONS.length - 1, currentIndex + dir));
    setCurrentIndex(newIdx);
  }, [currentIndex]);

  const handleFinish = useCallback(() => {
    setScreen("results");
  }, []);

  const handleRetry = useCallback(() => {
    setScreen("welcome");
    setCurrentIndex(0);
    setAnswers({});
  }, []);

  const currentQuestion = QUESTIONS[currentIndex];

  useEffect(() => {
    if (screen === "quiz" && currentIndex === QUESTIONS.length - 1 && answers[QUESTIONS[currentIndex].id]) {
      const timer = setTimeout(() => setScreen("results"), 1200);
      return () => clearTimeout(timer);
    }
  }, [screen, currentIndex, answers]);

  return (
    <main className="min-h-screen bg-background text-foreground relative">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {screen === "welcome" && (
            <motion.div key="welcome" exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <WelcomeScreen onStart={handleStart} />
            </motion.div>
          )}

          {screen === "quiz" && currentQuestion && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }} className="px-4 py-6 md:px-8 md:py-8">
              <QuizQuestion
                key={currentQuestion.id}
                question={currentQuestion}
                answers={answers}
                onAnswer={(userAnswer, correct) => handleAnswer(currentQuestion.id, userAnswer, correct)}
                onNavigate={handleNavigate}
                totalQuestions={QUESTIONS.length}
                currentIndex={currentIndex}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                activeRefTab={activeRefTab}
              />
            </motion.div>
          )}

          {screen === "results" && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <ResultsScreen answers={answers} onRetry={handleRetry} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function Page() {
  return <MathPractice />;
}
