"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Trophy, ChevronRight, ChevronLeft, Clock, MapPin,
  Palette, Globe, Crown, Swords, Sparkles, CheckCircle2,
  XCircle, HelpCircle, Star, ArrowRight, RotateCcw, Home,
  Target, Lightbulb, Shield, Scroll, Award, Brain, Zap,
  Layers, Compass, BookMarked, Landmark, Flag, Calendar,
  FileText, Users, Wrench, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ──────────────────────── TYPES ──────────────────────── */

type QuestionType =
  | "matching"
  | "source_who_when"
  | "source_details"
  | "map_event"
  | "map_cities"
  | "argumentation"
  | "chronology"
  | "culture_century"
  | "culture_creator"
  | "vov";

interface MatchPair {
  id: string;
  label: string;
  correctAnswer: string;
}

interface SourceQuestion {
  text: string;
  personAnswer: string;
  yearAnswer: string;
  details?: { question: string; answer: string }[];
}

interface MapEventQ {
  description: string;
  correctAnswer: string;
  options: string[];
}

interface MapCitiesQ {
  description: string;
  correctCity: string;
  options: string[];
}

interface ArgumentationQ {
  viewpoint: string;
  facts: string[];
  correctFactIndex: number;
}

interface ChronologyQ {
  russianEvent: string;
  correctHalf: string;
  foreignEventOptions: string[];
  correctForeignIndex: number;
}

interface CultureCenturyQ {
  century: string;
  monuments: string[];
  correctIndices: number[];
}

interface CultureCreatorQ {
  monument: string;
  creatorOptions: string[];
  correctCreatorIndex: number;
}

interface VovQ {
  question: string;
  options: string[];
  correctIndex: number;
}

interface Question {
  id: number;
  type: QuestionType;
  typeName: string;
  typeIcon: string;
  matchPairs?: MatchPair[];
  source?: SourceQuestion;
  mapEvent?: MapEventQ;
  mapCities?: MapCitiesQ;
  argumentation?: ArgumentationQ;
  chronology?: ChronologyQ;
  cultureCentury?: CultureCenturyQ;
  cultureCreator?: CultureCreatorQ;
  vov?: VovQ;
  hint: string;
  explanation: string;
}

interface AnswerState {
  answered: boolean;
  correct: boolean;
  userAnswer: Record<string, string>;
  selectedFact?: string;
  foreignEvent?: string;
  selectedMonuments?: string[];
  selectedCreator?: string;
  vovAnswer?: string;
  explanation?: string;
}

type Screen = "home" | "quiz" | "results";

/* ──────────────────────── QUESTION DATA ──────────────────────── */

const QUESTIONS: Question[] = [
  // TYPE 1: MATCHING (3 questions)
  {
    id: 1,
    type: "matching",
    typeName: "Соответствие",
    typeIcon: "layers",
    matchPairs: [
      { id: "a", label: "А. Битва при Молодях", correctAnswer: "Воротынский" },
      { id: "b", label: "Б. Введение урочных лет", correctAnswer: "Фёдор Иоаннович" },
      { id: "c", label: "В. Взятие Казани", correctAnswer: "Иван IV Грозный" },
    ],
    hint: "Подумай: кто командовал войсками, кто был царём, кто издавал указы?",
    explanation: "Михаил Воротынский — полководец, разгромивший Девлет Гирея в 1572 г. Фёдор Иоаннович — царь, при котором в 1597 г. введены урочные лета. Иван IV Грозный — царь, под командованием которого в 1552 г. была взята Казань.",
  },
  {
    id: 2,
    type: "matching",
    typeName: "Соответствие",
    typeIcon: "layers",
    matchPairs: [
      { id: "a", label: "А. Стояние на р. Угре", correctAnswer: "Иван III" },
      { id: "b", label: "Б. Освобождение Москвы ополчением", correctAnswer: "Минин и Пожарский" },
      { id: "c", label: "В. Церковный раскол", correctAnswer: "Алексей Михайлович" },
    ],
    hint: "Свяжи событие с правителем, при котором оно произошло.",
    explanation: "Иван III — стояние на реке Угре в 1480 г. (конец ордынского ига). Минин и Пожарский — руководители Второго ополчения, освободившего Москву в 1612 г. Алексей Михайлович — при нём состоялся церковный раскол (реформы Никона).",
  },
  {
    id: 3,
    type: "matching",
    typeName: "Соответствие",
    typeIcon: "layers",
    matchPairs: [
      { id: "a", label: "А. Куликовская битва", correctAnswer: "Дмитрий Донской" },
      { id: "b", label: "Б. Учреждение патриаршества", correctAnswer: "Фёдор Иоаннович" },
      { id: "c", label: "В. Соборное уложение", correctAnswer: "Алексей Михайлович" },
    ],
    hint: "Дмитрий Донской — битва на Куликовом поле, Фёдор — патриаршество, Алексей — Соборное уложение.",
    explanation: "Дмитрий Донской разбил Мамая на Куликовом поле в 1380 г. Фёдор Иоаннович учредил патриаршество в России в 1589 г. Алексей Михайлович принял Соборное уложение в 1649 г.",
  },
  // TYPE 2: SOURCE - WHO & WHEN (2 questions)
  {
    id: 4,
    type: "source_who_when",
    typeName: "Источник: кто и когда",
    typeIcon: "scroll",
    source: {
      text: "В лето 7022 (1514) великий князь Василий Иванович взял град Смоленск, который был под властью Литвы более ста лет. Горожане радостно встретили русские войска, возвращаясь в состав Русского государства.",
      personAnswer: "Василий III",
      yearAnswer: "1514",
    },
    hint: "Кто был великим князем в начале XVI века? Какой год указан в летописной дате 7022?",
    explanation: "В летописной дате 7022 от сотворения мира соответствует 1514 год от Р.Х. (7022 - 5508 = 1514). Великий князь Василий Иванович — это Василий III, правивший с 1505 по 1533 гг.",
  },
  {
    id: 5,
    type: "source_who_when",
    typeName: "Источник: кто и когда",
    typeIcon: "scroll",
    source: {
      text: "Того же лета (6988) князь великий Иван Васильевич и царь Ахмат стояли на реке на Угре. Царь не перешёл реку и отошёл, и так закончилось татарское иго.",
      personAnswer: "Иван III",
      yearAnswer: "1480",
    },
    hint: "6988 - 5508 = ? Какой великий князь носил имя Иван Васильевич в конце XV века?",
    explanation: "Летописный год 6988 corresponds to 1480 год (6988 - 5508 = 1480). Великий князь Иван Васильевич — это Иван III, который правил с 1462 по 1505 гг.",
  },
  // TYPE 3: SOURCE - DETAILS (2 questions)
  {
    id: 6,
    type: "source_details",
    typeName: "Источник: детали",
    typeIcon: "file-text",
    source: {
      text: "В лето 7022 (1514) великий князь Василий Иванович взял град Смоленск, который был под властью Литвы более ста лет. Горожане радостно встретили русские войска, возвращаясь в состав Русского государства.",
      details: [
        { question: "Какой город был возвращён в состав Русского государства?", answer: "Смоленск" },
        { question: "Под властью какого государства находился город?", answer: "Литвы (Великого княжества Литовского)" },
      ],
    },
    hint: "Перечитай текст внимательно — ответы прямо в нём.",
    explanation: "Из текста прямо следует, что город Смоленск был под властью Литвы и был возвращён в состав Русского государства.",
  },
  {
    id: 7,
    type: "source_details",
    typeName: "Источник: детали",
    typeIcon: "file-text",
    source: {
      text: "В 1552 году царь Иван IV лично участвовал в походе на Казанское ханство. После длительной осады город пал, и ханство было присоединено к России. Царь приказал построить в Москве храм в память об этой победе.",
      details: [
        { question: "Какое ханство было присоединено?", answer: "Казанское ханство" },
        { question: "Какой храм был построен в Москве в память о победе?", answer: "Храм Василия Блаженного (Покровский собор)" },
      ],
    },
    hint: "Храм на Красной площади с разноцветными куполами — один из символов Москвы.",
    explanation: "Казанское ханство было присоединено к России в 1552 году. В честь победы был построен Храм Василия Блаженного (Покровский собор) на Красной площади в Москве.",
  },
  // TYPE 4: MAP - EVENT (2 questions)
  {
    id: 8,
    type: "map_event",
    typeName: "Карта: событие",
    typeIcon: "map",
    mapEvent: {
      description: "На карте изображены территории Поволжья: Волга от Казани до Астрахани, отмечены города Царицын, Симбирск, Саратов. Красными стрелками показано движение восставших по Волге. Это событие произошло в 1670-1671 годах.",
      correctAnswer: "Восстание Степана Разина",
      options: [
        "Восстание Степана Разина",
        "Крестьянская война под предводительством Е. Пугачёва",
        "Смутное время",
        "Ливонская война",
      ],
    },
    hint: "Восстание в Поволжье в 1670-1671 гг. — кто им руководил?",
    explanation: "Восстание Степана Разина (1670-1671) проходило в Поволжье. Восставшие двигались по Волге от Астрахани к Симбирску. Это отличает его от восстания Пугачёва, которое было позже (1773-1775).",
  },
  {
    id: 9,
    type: "map_event",
    typeName: "Карта: событие",
    typeIcon: "map",
    mapEvent: {
      description: "На карте изображена территория России начала XVII века. Стрелками показано движение польских и шведских войск. Отмечены города: Москва, Смоленск, Новгород. Пунктиром показано движение ополчения из Нижнего Новгорода к Москве.",
      correctAnswer: "Смутное время",
      options: [
        "Смутное время",
        "Ливонская война",
        "Куликовская битва",
        "Восстание Разина",
      ],
    },
    hint: "Начало XVII века — период, когда в России не было законного царя, иностранные войска на территории страны.",
    explanation: "Смутное время (1598-1613) — период политического кризиса. Иностранные войска (польские и шведские) находились на территории России. Второе ополчение Минина и Пожарского шло из Нижнего Новгорода на Москву для освобождения столицы.",
  },
  // TYPE 5: MAP - CITIES (2 questions)
  {
    id: 10,
    type: "map_cities",
    typeName: "Карта: города",
    typeIcon: "compass",
    mapCities: {
      description: "На исторической карте восстания Степана Разина (1670-1671) отмечен город, расположенный на Волге при впадении в неё реки Царицы. Этот город выполнял ключевую роль в контроле над Волжским путём.",
      correctCity: "Царицын",
      options: ["Царицын", "Азовор", "Тамбов", "Елец"],
    },
    hint: "Город назван по названию реки Царицы, притока Волги. Сейчас он носит другое имя.",
    explanation: "Царицын (ныне Волгоград) расположен на Волге при впадении реки Царицы. Город был важным пунктом на пути движения армии Разина по Волге.",
  },
  {
    id: 11,
    type: "map_cities",
    typeName: "Карта: города",
    typeIcon: "compass",
    mapCities: {
      description: "На карте Ливонской войны (1558-1583) отмечен город-крепость на западной границе Русского государства, который был взят войсками Стефана Батория в 1580 году после долгой осады. Этот город находился на пути к Москве.",
      correctCity: "Псков",
      options: ["Псков", "Смоленск", "Новгород", "Казань"],
    },
    hint: "Город на западе России, который героически оборонялся от войск Батория и не был взят.",
    explanation: "Псков — ключевой город на западной границе. В 1581 году польско-литовские войска Стефана Батория осадили Псков, но город героически выдержал осаду.",
  },
  // TYPE 6: ARGUMENTATION (3 questions)
  {
    id: 12,
    type: "argumentation",
    typeName: "Аргументация",
    typeIcon: "brain",
    argumentation: {
      viewpoint: "Внешняя политика Ивана IV Грозного была успешной",
      facts: [
        "Битва при Молодях (1572 г.) — разгром войск Девлет Гирея",
        "Введение опричнины (1565 г.) — внутренний террор",
        "Ливонская война (1558-1583) — неудачная война за выход к Балтике",
        "Присоединение Казанского ханства (1552 г.)",
      ],
      correctFactIndex: 0,
    },
    hint: "Выбери факт, который РЕАЛЬНО подтверждает успех во внешней политике. Опричнина — внутреннее дело!",
    explanation: "Битва при Молодях — успешный разгром крымских войск Девлет Гирея, предотвращший угрозу Москве. Это пример успешной военной внешней политики. Ливонская война была неудачной, а опричнина — внутреннее мероприятие.",
  },
  {
    id: 13,
    type: "argumentation",
    typeName: "Аргументация",
    typeIcon: "brain",
    argumentation: {
      viewpoint: "Правление Ивана III стало переломным в истории России",
      facts: [
        "Создание Избранной рады",
        "Стояние на реке Угре (1480 г.) — окончательное свержение ордынского ига",
        "Церковный раскол при патриархе Никоне",
        "Восстание Степана Разина",
      ],
      correctFactIndex: 1,
    },
    hint: "Иван III правил в конце XV века. Событие 1480 года стало важнейшим в его правлении.",
    explanation: "Стояние на реке Угре (1480 г.) привело к окончательному свержению ордынского ига. Это переломное событие в истории России. Остальные факты относятся к другим правителям и эпохам.",
  },
  {
    id: 14,
    type: "argumentation",
    typeName: "Аргументация",
    typeIcon: "brain",
    argumentation: {
      viewpoint: "Избрание Михаила Романова стало концом Смутного времени",
      facts: [
        "Введение урочных лет (1597 г.)",
        "Земский собор 1613 года избрал Михаила Фёдоровича Романова на царство",
        "Соборное уложение (1649 г.)",
        "Основание Московского университета (1755 г.)",
      ],
      correctFactIndex: 1,
    },
    hint: "Что произошло в 1613 году, когда Смутное время подошло к концу?",
    explanation: "Земский собор 1613 года избрал Михаила Фёдоровича Романова на царство, что стало отправной точкой новой династии Романовых и символическим завершением Смутного времени.",
  },
  // TYPE 7: CHRONOLOGY (3 questions)
  {
    id: 15,
    type: "chronology",
    typeName: "Хронология",
    typeIcon: "calendar",
    chronology: {
      russianEvent: "Избрание Михаила Романова на царство (1613 г.)",
      correctHalf: "Первая половина XVII века",
      foreignEventOptions: [
        "Тридцатилетняя война (1618-1648)",
        "Английская революция (1640-1660)",
        "Подписание Утрехтской унии (1579)",
        "Славная революция в Англии (1688)",
      ],
      correctForeignIndex: 0,
    },
    hint: "1613 г. — это первая половина XVII века. Какое зарубежное событие также происходило в первой половине XVII века?",
    explanation: "1613 г. — первая половина XVII в. Тридцатилетняя война (1618-1648) — масштабный европейский конфликт, происходивший в первой половине XVII века. Английская революция началась в 1640 — тоже первая половина XVII в., но Тридцатилетняя война — более характерный пример.",
  },
  {
    id: 16,
    type: "chronology",
    typeName: "Хронология",
    typeIcon: "calendar",
    chronology: {
      russianEvent: "Взятие Казани Иваном IV (1552 г.)",
      correctHalf: "Вторая половина XVI века",
      foreignEventOptions: [
        "Реформация и начало протестантизма",
        "Подписание Утрехтской унии (1579)",
        "Тридцатилетняя война (1618-1648)",
        "Великие географические открытия Колумба (1492)",
      ],
      correctForeignIndex: 1,
    },
    hint: "1552 г. — вторая половина XVI века. Утрехтская уния 1579 г. — тоже XVI век.",
    explanation: "1552 г. — вторая половина XVI в. Подписание Утрехтской унии (1579) объединило северные провинции Нидерландов и произошло во второй половине XVI века.",
  },
  {
    id: 17,
    type: "chronology",
    typeName: "Хронология",
    typeIcon: "calendar",
    chronology: {
      russianEvent: "Соборное уложение Алексея Михайловича (1649 г.)",
      correctHalf: "Вторая половина XVII века",
      foreignEventOptions: [
        "Тридцатилетняя война (1618-1648)",
        "Славная революция в Англии (1688)",
        "Реформация (начало XVI в.)",
        "Великие географические открытия (конец XV в.)",
      ],
      correctForeignIndex: 1,
    },
    hint: "1649 г. — это вторая половина XVII века. Какое событие произошло в Англии в 1688 году?",
    explanation: "1649 г. — вторая половина XVII в. Славная революция в Англии (1688) произошла во второй половине XVII века — свержение Якова II и утверждение конституционной монархии.",
  },
  // TYPE 8: CULTURE - CENTURY (2 questions)
  {
    id: 18,
    type: "culture_century",
    typeName: "Культура: век",
    typeIcon: "palette",
    cultureCentury: {
      century: "XVI век",
      monuments: [
        "«Великие Четьи-Минеи» (сборник житий святых)",
        "«Синопсис» (первый учебник русской истории)",
        "Храм Василия Блаженного",
        "Теремной дворец в Московском Кремле",
      ],
      correctIndices: [0, 2],
    },
    hint: "«Великие Четьи-Минеи» — труд митрополита Макария (XVI в.). Храм Василия Блаженного построен при Иване IV (XVI в.).",
    explanation: "«Великие Четьи-Минеи» (собраны митрополитом Макарием в середине XVI в.) и Храм Василия Блаженного (построен в 1555-1561 гг. при Иване IV) относятся к XVI веку. «Синопсис» — XVII век, Теремной дворец — XVII век.",
  },
  {
    id: 19,
    type: "culture_century",
    typeName: "Культура: век",
    typeIcon: "palette",
    cultureCentury: {
      century: "XVII век",
      monuments: [
        "«Домострой» (свод правил поведения)",
        "«Калязинская челобитная»",
        "Парсуна «Патриарх Никон с клиром»",
        "Стоглав",
      ],
      correctIndices: [1, 2],
    },
    hint: "«Домострой» и Стоглав — XVI век. «Калязинская челобитная» и парсуна — XVII век.",
    explanation: "«Калязинская челобитная» (памятник XVII в.) и парсуна «Патриарх Никон с клиром» (XVII в.) относятся к XVII веку. «Домострой» и Стоглав — памятники XVI века.",
  },
  // TYPE 9: CULTURE - CREATOR (2 questions)
  {
    id: 20,
    type: "culture_creator",
    typeName: "Культура: автор",
    typeIcon: "book-marked",
    cultureCreator: {
      monument: "«Великие Четьи-Минеи» (многочисленный свод житий святых)",
      creatorOptions: [
        "Митрополит Макарий",
        "Протопоп Аввакум",
        "Патриарх Никон",
        "Сильвестр (священник Благовещенского собора)",
      ],
      correctCreatorIndex: 0,
    },
    hint: "Этот церковный иерарх при Иване IV собирал жития святых для создания крупнейшего литературного памятника.",
    explanation: "«Великие Четьи-Минеи» — многотомный свод житий святых, составленный по инициативе митрополита Макария в середине XVI века при Иване IV Грозном.",
  },
  {
    id: 21,
    type: "culture_creator",
    typeName: "Культура: автор",
    typeIcon: "book-marked",
    cultureCreator: {
      monument: "«Домострой» (свод правил семейной и хозяйственной жизни)",
      creatorOptions: [
        "Митрополит Макарий",
        "Протопоп Аввакум",
        "Священник Сильвестр (или кто-то из его окружения)",
        "Патриарх Иов",
      ],
      correctCreatorIndex: 2,
    },
    hint: "Этот священник был одним из членов Избранной рады и духовником молодого Ивана IV.",
    explanation: "«Домострой» — памятник XVI века, авторство которого традиционно приписывается священнику Сильвестру, духовнику Ивана IV Грозного и члену Избранной рады.",
  },
  // TYPE 10: VOV (3 questions)
  {
    id: 22,
    type: "vov",
    typeName: "ВОВ",
    typeIcon: "shield",
    vov: {
      question: "В каком году закончилась Великая Отечественная война?",
      options: ["1943", "1944", "1945", "1946"],
      correctIndex: 2,
    },
    hint: "Вспомни дату капитуляции Германии — май...",
    explanation: "Великая Отечественная война закончилась 9 мая 1945 года с капитуляцией нацистской Германии. Вторая мировая война завершилась 2 сентября 1945 года после капитуляции Японии.",
  },
  {
    id: 23,
    type: "vov",
    typeName: "ВОВ",
    typeIcon: "shield",
    vov: {
      question: "Что означает День Победы в истории России?",
      options: [
        "Победа в Северной войне со Швецией",
        "Победа СССР в Великой Отечественной войне над фашистской Германией",
        "Победа в Крымской войне",
        "Окончание Гражданской войны",
      ],
      correctIndex: 1,
    },
    hint: "День Победы — 9 мая — это праздник в память о победе в самой кровопролитной войне XX века.",
    explanation: "День Победы (9 мая) — день победы Советского Союза в Великой Отечественной войне (1941-1945) над фашистской Германией. Это важнейший государственный праздник России.",
  },
  {
    id: 24,
    type: "vov",
    typeName: "ВОВ",
    typeIcon: "shield",
    vov: {
      question: "Какое событие произошло в Сталинграде в 1943 году?",
      options: [
        "Капитуляция Германии",
        "Разгром немецко-фашистских войск — коренной перелом в войне",
        "Начало войны с Японией",
        "Блокада Ленинграда",
      ],
      correctIndex: 1,
    },
    hint: "Сталинградская битва — одно из самых значимых сражений, после которого инициатива перешла к Красной Армии.",
    explanation: "Сталинградская битва завершилась разгромом немецко-фашистских войск в феврале 1943 года. Она стала коренным переломом в Великой Отечественной войне — стратегическая инициатива перешла к Красной Армии.",
  },
];

/* ──────────────────────── REFERENCE DATA ──────────────────────── */

const REF_RULERS = [
  { name: "Иван III", years: "1462-1505", acts: "Стояние на р. Угре (1480), свержение ордынского ига, объединение русских земель" },
  { name: "Василий III", years: "1505-1533", acts: "Присоединение Пскова (1510), Смоленска (1514), Рязани (1521)" },
  { name: "Иван IV Грозный", years: "1533-1584", acts: "Избранная Рада, взятие Казани (1552), Ливонская война (1558-1583), опричнина (1565), битва при Молодях (1572)" },
  { name: "Фёдор Иоаннович", years: "1584-1598", acts: "Учреждение патриаршества (1589), введение урочных лет (1597)" },
  { name: "Борис Годунов", years: "1598-1605", acts: "Начало Смутного времени, строительство крепостей" },
  { name: "Михаил Романов", years: "1613-1645", acts: "Избрание на царство Земским собором (1613), начало династии Романовых" },
  { name: "Алексей Михайлович", years: "1645-1676", acts: "Соборное уложение (1649), церковный раскол, восстание Разина (1670-1671)" },
];

const REF_EVENTS = [
  { date: "1380", event: "Куликовская битва", detail: "Дмитрий Донской разбил Мамая" },
  { date: "1480", event: "Стояние на р. Угре", detail: "Иван III, Ахмат. Конец ордынского ига" },
  { date: "1514", event: "Взятие Смоленска", detail: "Василий III, присоединение к Русскому государству" },
  { date: "1552", event: "Взятие Казани", detail: "Иван IV, присоединение Казанского ханства" },
  { date: "1555-1561", event: "Храм Василия Блаженного", detail: "Построен в честь взятия Казани" },
  { date: "1558-1583", event: "Ливонская война", detail: "Борьба за выход к Балтийскому морю" },
  { date: "1572", event: "Битва при Молодях", detail: "Воротынский разбил Девлет Гирея" },
  { date: "1589", event: "Учреждение патриаршества", detail: "Первый патриарх — Иов" },
  { date: "1597", event: "Урочные лета", detail: "5-летний срок сыска беглых крестьян" },
  { date: "1612", event: "Освобождение Москвы", detail: "Второе ополчение Минина и Пожарского" },
  { date: "1613", event: "Избрание Михаила Романова", detail: "Земский собор, начало династии Романовых" },
  { date: "1649", event: "Соборное уложение", detail: "Алексей Михайлович, основной закон России" },
  { date: "1654", event: "Церковный раскол", detail: "Реформы патриарха Никона" },
  { date: "1670-1671", event: "Восстание Разина", detail: "Крестьянская война в Поволжье" },
  { date: "1941-1945", event: "Великая Отечественная война", detail: "Победа над фашистской Германией, 9 мая 1945" },
];

const REF_CULTURE = [
  { century: "XVI век", items: [
    "«Великие Четьи-Минеи» — митрополит Макарий",
    "Храм Василия Блаженного — Постник и Барма (традиционно)",
    "«Домострой» — священник Сильвестр",
    "Церковь Вознесения в Коломенском",
    "Стоглав — церковный собор 1551 г.",
  ]},
  { century: "XVII век", items: [
    "«Калязинская челобитная»",
    "Теремной дворец в Московском Кремле",
    "Парсуна «Патриарх Никон с клиром»",
    "«Синопсис» — первый учебник русской истории (Иннокентий Гизель)",
  ]},
];

const REF_FOREIGN = [
  { period: "Первая половина XVI в.", events: [
    "Реформация (Мартин Лютер, 1517)",
    "Завоевания ацтеков (Кортес, 1519-1521)",
    "Завоевания инков (Писарро, 1532)",
  ]},
  { period: "Вторая половина XVI в.", events: [
    "Подписание Утрехтской унии (1579)",
    "Разгром Непобедимой армады (1588)",
    "Барская konfederacja",
  ]},
  { period: "Первая половина XVII в.", events: [
    "Тридцатилетняя война (1618-1648)",
    "Английская революция (1640-1660)",
  ]},
  { period: "Вторая половина XVII в.", events: [
    "Славная революция в Англии (1688)",
    "Войны Людовика XIV",
  ]},
];

const REF_FOREIGN_FIGURES = [
  { name: "Игнатий Лойола", achievement: "Основатель ордена иезуитов" },
  { name: "Васко да Гама", achievement: "Морской путь в Индию (1498)" },
  { name: "Христофор Колумб", achievement: "Открытие Америки (1492)" },
  { name: "Френсис Дрейк", achievement: "Английский пират и адмирал, кругосветное плавание" },
  { name: "Томас Мюнцер", achievement: "Лидер крестьянской войны в Германии" },
];

const REF_CHRONOLOGY = [
  { century: "XIV", events: ["Куликовская битва (1380)", "Битва на Воже (1378)"] },
  { century: "XV", events: ["Стояние на р. Угре (1480)", "Феодальная война"] },
  { century: "XVI", events: ["Взятие Казани (1552)", "Ливонская война", "Опричнина", "Битва при Молодях (1572)"] },
  { century: "XVII", events: ["Смутное время (1598-1613)", "Соборное уложение (1649)", "Церковный раскол", "Восстание Разина (1670-1671)"] },
];

const TYPE_META: Record<QuestionType, { label: string; icon: React.ReactNode; color: string }> = {
  matching: { label: "Соответствие", icon: <Layers size={16} />, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  source_who_when: { label: "Источник: кто и когда", icon: <Scroll size={16} />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  source_details: { label: "Источник: детали", icon: <FileText size={16} />, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  map_event: { label: "Карта: событие", icon: <MapPin size={16} />, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  map_cities: { label: "Карта: города", icon: <Compass size={16} />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  argumentation: { label: "Аргументация", icon: <Brain size={16} />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  chronology: { label: "Хронология", icon: <Calendar size={16} />, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  culture_century: { label: "Культура: век", icon: <Palette size={16} />, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  culture_creator: { label: "Культура: автор", icon: <BookMarked size={16} />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  vov: { label: "ВОВ", icon: <Shield size={16} />, color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

/* ──────────────────────── SVG TIMELINE ──────────────────────── */

const TIMELINE_EVENTS = [
  { year: "1380", label: "Куликовская битва", x: 8 },
  { year: "1480", label: "Стояние на Угре", x: 24 },
  { year: "1514", label: "Взятие Смоленска", x: 33 },
  { year: "1552", label: "Взятие Казани", x: 41 },
  { year: "1572", label: "Битва при Молодях", x: 47 },
  { year: "1613", label: "Михаил Романов", x: 58 },
  { year: "1649", label: "Соборное уложение", x: 68 },
  { year: "1671", label: "Конец восстания Разина", x: 78 },
  { year: "1945", label: "Победа в ВОВ", x: 94 },
];

function TimelineSVG({ highlightedEvent }: { highlightedEvent?: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 1000 180" className="w-full min-w-[600px]" preserveAspectRatio="xMidYMid meet">
        {/* Background glow */}
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
            <stop offset="30%" stopColor="#f59e0b" stopOpacity="1" />
            <stop offset="70%" stopColor="#d97706" stopOpacity="1" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Main line */}
        <motion.line
          x1="50" y1="90" x2="950" y2="90"
          stroke="url(#lineGrad)" strokeWidth="2" filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Century labels */}
        {["XIV", "XV", "XVI", "XVII", "XX"].map((c, i) => (
          <text key={c} x={50 + i * 190} y="170" fill="#6b7280" fontSize="11" textAnchor="middle" fontFamily="var(--font-sans)">
            {c}
          </text>
        ))}
        {["XIV", "XV", "XVI", "XVII", "XX"].map((c, i) => (
          <text key={`c${c}`} x={50 + i * 190} y="25" fill="#9ca3af" fontSize="13" textAnchor="middle" fontWeight="bold" fontFamily="var(--font-sans)">
            {c} в.
          </text>
        ))}

        {/* Events */}
        {TIMELINE_EVENTS.map((evt, i) => {
          const x = evt.x * 10;
          const isHovered = hoveredIdx === i;
          const isHighlighted = highlightedEvent?.includes(evt.label) || highlightedEvent?.includes(evt.year);
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {/* Vertical line */}
              <line x1={x} y1={40} x2={x} y2={85} stroke={isHighlighted ? "#10b981" : "#4b5563"} strokeWidth="1" strokeDasharray={isHighlighted ? "none" : "3,3"} />
              {/* Dot */}
              <motion.circle
                cx={x} cy={90} r={isHovered || isHighlighted ? 7 : 5}
                fill={isHighlighted ? "#10b981" : "#f59e0b"}
                filter={isHovered || isHighlighted ? "url(#glowStrong)" : "url(#glow)"}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.15, type: "spring" }}
              />
              {/* Year label */}
              <text x={x} y={115} fill={isHighlighted ? "#10b981" : "#f59e0b"} fontSize="11" textAnchor="middle" fontWeight="bold" fontFamily="var(--font-sans)">
                {evt.year}
              </text>
              {/* Event label */}
              <text x={x} y={132} fill={isHovered ? "#fef3c7" : "#9ca3af"} fontSize="9" textAnchor="middle" fontFamily="var(--font-sans)">
                {evt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ──────────────────────── HELPER COMPONENTS ──────────────────────── */

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const meta = TYPE_META[type];
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-medium", meta.color)}>
      {meta.icon}
      {meta.label}
    </Badge>
  );
}

function FeedbackBadge({ correct }: { correct: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
        correct
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
      )}
    >
      {correct ? (
        <>
          <CheckCircle2 size={18} />
          Правильно!
        </>
      ) : (
        <>
          <XCircle size={18} />
          Неверно
        </>
      )}
    </motion.div>
  );
}

function HintCard({ hint }: { hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Button
        variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 gap-1"
        onClick={() => setShow(!show)}
      >
        <Lightbulb size={14} />
        {show ? "Скрыть подсказку" : "Показать подсказку"}
      </Button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300/80 text-sm">
              💡 {hint}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────── REFERENCE SIDEBAR ──────────────────────── */

function ReferenceSidebar({ currentQuestion }: { currentQuestion?: Question }) {
  return (
    <Card className="bg-[#111827] border-amber-900/20 overflow-hidden h-full">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-amber-400 text-base flex items-center gap-2">
          <BookOpen size={18} />
          Справочник
        </CardTitle>
      </CardHeader>
      <Tabs defaultValue="chronology" className="px-4">
        <TabsList className="grid grid-cols-5 w-full bg-[#0a0e18] h-9 mb-3">
          <TabsTrigger value="chronology" className="text-[10px] px-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Clock size={12} className="mr-0.5" />
            <span className="hidden sm:inline">Хрон</span>
          </TabsTrigger>
          <TabsTrigger value="rulers" className="text-[10px] px-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Crown size={12} className="mr-0.5" />
            <span className="hidden sm:inline">Правит</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="text-[10px] px-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Swords size={12} className="mr-0.5" />
            <span className="hidden sm:inline">Событ</span>
          </TabsTrigger>
          <TabsTrigger value="culture" className="text-[10px] px-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Palette size={12} className="mr-0.5" />
            <span className="hidden sm:inline">Культ</span>
          </TabsTrigger>
          <TabsTrigger value="foreign" className="text-[10px] px-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Globe size={12} className="mr-0.5" />
            <span className="hidden sm:inline">Заруб</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chronology" className="mt-0">
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 pb-4">
              {REF_CHRONOLOGY.map((c) => (
                <div key={c.century}>
                  <h4 className="text-amber-400 font-bold text-xs mb-1">{c.century} век</h4>
                  <ul className="space-y-1">
                    {c.events.map((e, i) => (
                      <li key={i} className="text-gray-400 text-xs flex items-start gap-1.5">
                        <span className="text-amber-600 mt-0.5">▸</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rulers" className="mt-0">
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 pb-4">
              {REF_RULERS.map((r) => (
                <div key={r.name} className="p-2 rounded-lg bg-[#0a0e18] border border-amber-900/10">
                  <div className="flex items-center gap-2">
                    <Crown size={12} className="text-amber-500 shrink-0" />
                    <span className="text-amber-300 font-semibold text-xs">{r.name}</span>
                    <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700 shrink-0">{r.years}</Badge>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">{r.acts}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="events" className="mt-0">
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-2 pb-4">
              {REF_EVENTS.map((e, i) => (
                <div key={i} className="p-2 rounded-lg bg-[#0a0e18] border border-amber-900/10">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-mono text-xs font-bold">{e.date}</span>
                    <span className="text-gray-300 text-xs font-medium">{e.event}</span>
                  </div>
                  <p className="text-gray-500 text-[11px] mt-0.5">{e.detail}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="culture" className="mt-0">
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 pb-4">
              {REF_CULTURE.map((c) => (
                <div key={c.century}>
                  <h4 className="text-pink-400 font-bold text-xs mb-1">{c.century}</h4>
                  <ul className="space-y-1">
                    {c.items.map((item, i) => (
                      <li key={i} className="text-gray-400 text-[11px] flex items-start gap-1.5">
                        <span className="text-pink-600 mt-0.5">▸</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="foreign" className="mt-0">
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 pb-4">
              <h4 className="text-cyan-400 font-bold text-xs mb-2">События по периодам</h4>
              {REF_FOREIGN.map((p) => (
                <div key={p.period}>
                  <h5 className="text-gray-300 text-[11px] font-semibold mb-1">{p.period}</h5>
                  <ul className="space-y-0.5 ml-2">
                    {p.events.map((e, i) => (
                      <li key={i} className="text-gray-500 text-[11px]">• {e}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <Separator className="my-3 bg-amber-900/20" />
              <h4 className="text-cyan-400 font-bold text-xs mb-2">Деятели</h4>
              {REF_FOREIGN_FIGURES.map((f) => (
                <div key={f.name} className="flex items-start gap-2 py-1">
                  <Users size={11} className="text-cyan-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-gray-300 text-[11px] font-semibold">{f.name}</span>
                    <span className="text-gray-500 text-[11px]"> — {f.achievement}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/* ──────────────────────── QUESTION RENDERERS ──────────────────────── */

function MatchingQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const pairs = question.matchPairs!;
  const options = useMemo(() => {
    const allAnswers = [...new Set(pairs.map((p) => p.correctAnswer))];
    const extras = ["Минин и Пожарский", "Борис Годунов", "Дмитрий Донской"];
    while (allAnswers.length < 5) {
      const extra = extras.find((e) => !allAnswers.includes(e));
      if (extra) allAnswers.push(extra);
      else break;
    }
    return allAnswers.sort(() => Math.random() - 0.5);
  }, [pairs]);

  return (
    <div className="space-y-4">
      <p className="text-gray-300 text-sm">Установите соответствие между событиями и их участниками:</p>
      <div className="grid gap-3">
        {pairs.map((pair) => (
          <div key={pair.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-amber-300 text-sm font-medium min-w-[200px] bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-900/20">
              {pair.label}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {options.map((opt) => {
                const isSelected = answers.userAnswer[pair.id] === opt;
                const isCorrect = answers.answered && opt === pair.correctAnswer;
                const isWrong = answers.answered && isSelected && opt !== pair.correctAnswer;
                return (
                  <motion.button
                    key={opt}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={answers.answered}
                    onClick={() => setAnswer(pair.id, opt)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      isSelected && !answers.answered && "bg-amber-500/30 text-amber-300 border-amber-500/50",
                      isCorrect && "bg-emerald-500/30 text-emerald-300 border-emerald-500/50 ring-2 ring-emerald-500/30",
                      isWrong && "bg-rose-500/30 text-rose-300 border-rose-500/50",
                      !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-amber-500/30 hover:text-gray-300"
                    )}
                  >
                    {opt}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceWhoWhenQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const src = question.source!;
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-[#0a0e18] border border-amber-900/20">
        <p className="text-xs text-amber-500 mb-2 flex items-center gap-1"><Scroll size={12} /> Исторический источник</p>
        <p className="text-gray-300 text-sm leading-relaxed italic">{src.text}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">О каком человеке идёт речь?</label>
          <Input
            value={answers.userAnswer["person"] || ""}
            onChange={(e) => setAnswer("person", e.target.value)}
            disabled={answers.answered}
            placeholder="Введите имя..."
            className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm h-10"
          />
          {answers.answered && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn(
              "text-xs mt-1",
              answers.userAnswer["person"]?.trim().toLowerCase().includes(src.personAnswer.toLowerCase())
                ? "text-emerald-400" : "text-rose-400"
            )}>
              Ответ: {src.personAnswer}
            </motion.p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Укажите год ключевого события</label>
          <Input
            value={answers.userAnswer["year"] || ""}
            onChange={(e) => setAnswer("year", e.target.value)}
            disabled={answers.answered}
            placeholder="Например: 1480"
            className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm h-10"
          />
          {answers.answered && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn(
              "text-xs mt-1",
              answers.userAnswer["year"]?.trim() === src.yearAnswer
                ? "text-emerald-400" : "text-rose-400"
            )}>
              Ответ: {src.yearAnswer}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceDetailsQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const src = question.source!;
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-[#0a0e18] border border-amber-900/20">
        <p className="text-xs text-cyan-500 mb-2 flex items-center gap-1"><Scroll size={12} /> Исторический источник</p>
        <p className="text-gray-300 text-sm leading-relaxed italic">{src.text}</p>
      </div>
      <div className="space-y-3">
        {(src.details || []).map((d, i) => (
          <div key={i}>
            <label className="text-xs text-gray-400 mb-1 block">{d.question}</label>
            <Input
              value={answers.userAnswer[`detail_${i}`] || ""}
              onChange={(e) => setAnswer(`detail_${i}`, e.target.value)}
              disabled={answers.answered}
              placeholder="Введите ответ..."
              className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm h-10"
            />
            {answers.answered && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs mt-1 text-amber-400">
                Ответ: {d.answer}
              </motion.p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MapEventQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.mapEvent!;
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-[#0a0e18] border border-green-900/20">
        <p className="text-xs text-green-500 mb-2 flex items-center gap-1"><MapPin size={12} /> Описание исторической карты</p>
        <p className="text-gray-300 text-sm leading-relaxed">{q.description}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">Какое событие/период изображено на карте?</p>
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isSelected = answers.userAnswer["mapEvent"] === opt;
            const isCorrect = answers.answered && opt === q.correctAnswer;
            const isWrong = answers.answered && isSelected && opt !== q.correctAnswer;
            return (
              <motion.button
                key={opt}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={answers.answered}
                onClick={() => setAnswer("mapEvent", opt)}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",
                  isSelected && !answers.answered && "bg-amber-500/20 text-amber-300 border-amber-500/40",
                  isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                  isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-green-500/30 hover:text-gray-300"
                )}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MapCitiesQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.mapCities!;
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-[#0a0e18] border border-emerald-900/20">
        <p className="text-xs text-emerald-500 mb-2 flex items-center gap-1"><Compass size={12} /> Историческая география</p>
        <p className="text-gray-300 text-sm leading-relaxed">{q.description}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">Укажите название города:</p>
        <div className="grid grid-cols-2 gap-2">
          {q.options.map((opt) => {
            const isSelected = answers.userAnswer["mapCity"] === opt;
            const isCorrect = answers.answered && opt === q.correctCity;
            const isWrong = answers.answered && isSelected && opt !== q.correctCity;
            return (
              <motion.button
                key={opt}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                disabled={answers.answered}
                onClick={() => setAnswer("mapCity", opt)}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm font-medium border transition-all",
                  isSelected && !answers.answered && "bg-amber-500/20 text-amber-300 border-amber-500/40",
                  isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                  isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-emerald-500/30 hover:text-gray-300"
                )}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ArgumentationQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.argumentation!;
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-purple-400 mb-1">Точка зрения:</p>
        <p className="text-gray-300 text-sm font-medium italic">«{q.viewpoint}»</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">Выберите один факт, подтверждающий эту точку зрения:</p>
        <div className="grid gap-2">
          {q.facts.map((fact, i) => {
            const isSelected = answers.selectedFact === fact;
            const isCorrect = answers.answered && i === q.correctFactIndex;
            const isWrong = answers.answered && isSelected && i !== q.correctFactIndex;
            return (
              <motion.button
                key={i}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={answers.answered}
                onClick={() => setAnswer("selectedFact", fact)}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",
                  isSelected && !answers.answered && "bg-purple-500/20 text-purple-300 border-purple-500/40",
                  isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                  isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-purple-500/30 hover:text-gray-300"
                )}
              >
                <span className="text-gray-500 mr-2">{String.fromCharCode(65 + i)}.</span>
                {fact}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Объясните, почему выбранный факт подтверждает точку зрения:</label>
        <Textarea
          value={answers.explanation || ""}
          onChange={(e) => setAnswer("explanation", e.target.value)}
          disabled={answers.answered}
          placeholder="Напишите объяснение..."
          rows={3}
          className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm resize-none"
        />
      </div>
    </div>
  );
}

function ChronologyQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.chronology!;
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
        <p className="text-xs text-rose-400 mb-1">Российское событие:</p>
        <p className="text-gray-300 text-sm font-medium">{q.russianEvent}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-2">Укажите половину века, к которой относится это событие:</p>
        <div className="grid grid-cols-2 gap-2">
          {["Первая половина XVI века", "Вторая половина XVI века", "Первая половина XVII века", "Вторая половина XVII века"].map((opt) => {
            const isSelected = answers.userAnswer["half"] === opt;
            const isCorrect = answers.answered && opt === q.correctHalf;
            const isWrong = answers.answered && isSelected && opt !== q.correctHalf;
            return (
              <motion.button
                key={opt}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                disabled={answers.answered}
                onClick={() => setAnswer("half", opt)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                  isSelected && !answers.answered && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                  isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-rose-500/30 hover:text-gray-300"
                )}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-2">Укажите зарубежное событие из той же половины века:</p>
        <div className="grid gap-2">
          {q.foreignEventOptions.map((opt, i) => {
            const isSelected = answers.foreignEvent === opt;
            const isCorrect = answers.answered && i === q.correctForeignIndex;
            const isWrong = answers.answered && isSelected && i !== q.correctForeignIndex;
            return (
              <motion.button
                key={i}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={answers.answered}
                onClick={() => setAnswer("foreignEvent", opt)}
                className={cn(
                  "w-full text-left px-4 py-2 rounded-lg text-sm border transition-all",
                  isSelected && !answers.answered && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                  isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-rose-500/30 hover:text-gray-300"
                )}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CultureCenturyQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.cultureCentury!;
  const toggleMonument = (monument: string) => {
    const current = answers.selectedMonuments || [];
    if (current.includes(monument)) {
      setAnswer("selectedMonuments", JSON.stringify(current.filter((m) => m !== monument)));
    } else if (current.length < 2) {
      setAnswer("selectedMonuments", JSON.stringify([...current, monument]));
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
        <p className="text-pink-300 text-sm font-medium">
          Выберите <strong>ДВА</strong> памятника культуры, относящихся к <strong>{q.century}</strong>:
        </p>
      </div>
      <div className="grid gap-2">
        {q.monuments.map((monument, i) => {
          const selected = (answers.selectedMonuments || []).includes(monument);
          const isCorrect = answers.answered && q.correctIndices.includes(i);
          const isWrong = answers.answered && selected && !q.correctIndices.includes(i);
          const isMissed = answers.answered && !selected && q.correctIndices.includes(i);
          return (
            <motion.button
              key={i}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={answers.answered || (selected && (answers.selectedMonuments || []).length >= 2)}
              onClick={() => toggleMonument(monument)}
              className={cn(
                "w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",
                selected && !answers.answered && "bg-pink-500/20 text-pink-300 border-pink-500/40",
                isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                isMissed && "bg-amber-500/10 text-amber-400 border-amber-500/30 border-dashed",
                !selected && !isCorrect && !isWrong && !isMissed && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-pink-500/30 hover:text-gray-300"
              )}
            >
              <span className="text-gray-500 mr-2">{i + 1}.</span>
              {monument}
              {isCorrect && <CheckCircle2 size={14} className="inline ml-2 text-emerald-400" />}
              {isWrong && <XCircle size={14} className="inline ml-2 text-rose-400" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function CultureCreatorQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.cultureCreator!;
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
        <p className="text-xs text-orange-400 mb-1">Памятник культуры:</p>
        <p className="text-gray-300 text-sm font-medium">{q.monument}</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">Кто является автором/создателем этого памятника?</p>
        <div className="grid gap-2">
          {q.creatorOptions.map((opt, i) => {
            const isSelected = answers.selectedCreator === opt;
            const isCorrect = answers.answered && i === q.correctCreatorIndex;
            const isWrong = answers.answered && isSelected && i !== q.correctCreatorIndex;
            return (
              <motion.button
                key={i}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={answers.answered}
                onClick={() => setAnswer("selectedCreator", opt)}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",
                  isSelected && !answers.answered && "bg-orange-500/20 text-orange-300 border-orange-500/40",
                  isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                  isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                  !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-orange-500/30 hover:text-gray-300"
                )}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VovQuestion({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  const q = question.vov!;
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-red-400 mb-1 flex items-center gap-1"><Shield size={12} /> Великая Отечественная война</p>
        <p className="text-gray-300 text-sm font-medium">{q.question}</p>
      </div>
      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          const isSelected = answers.vovAnswer === opt;
          const isCorrect = answers.answered && i === q.correctIndex;
          const isWrong = answers.answered && isSelected && i !== q.correctIndex;
          return (
            <motion.button
              key={i}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={answers.answered}
              onClick={() => setAnswer("vovAnswer", opt)}
              className={cn(
                "w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",
                isSelected && !answers.answered && "bg-red-500/20 text-red-300 border-red-500/40",
                isCorrect && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                isWrong && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                !isSelected && !isCorrect && !isWrong && "bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-red-500/30 hover:text-gray-300"
              )}
            >
              {opt}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionRenderer({
  question,
  answers,
  setAnswer,
}: {
  question: Question;
  answers: AnswerState;
  setAnswer: (key: string, value: string) => void;
}) {
  switch (question.type) {
    case "matching": return <MatchingQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "source_who_when": return <SourceWhoWhenQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "source_details": return <SourceDetailsQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "map_event": return <MapEventQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "map_cities": return <MapCitiesQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "argumentation": return <ArgumentationQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "chronology": return <ChronologyQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "culture_century": return <CultureCenturyQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "culture_creator": return <CultureCreatorQuestion question={question} answers={answers} setAnswer={setAnswer} />;
    case "vov": return <VovQuestion question={question} answers={answers} setAnswer={setAnswer} />;
  }
}

/* ──────────────────────── CHECK ANSWERS ──────────────────────── */

function checkAnswer(question: Question, answers: AnswerState): boolean {
  switch (question.type) {
    case "matching": {
      return (question.matchPairs || []).every(
        (p) => answers.userAnswer[p.id] === p.correctAnswer
      );
    }
    case "source_who_when": {
      const src = question.source!;
      const personOk = answers.userAnswer["person"]?.trim().toLowerCase().includes(src.personAnswer.toLowerCase());
      const yearOk = answers.userAnswer["year"]?.trim() === src.yearAnswer;
      return personOk && yearOk;
    }
    case "source_details": {
      const src = question.source!;
      return (src.details || []).every((d, i) => {
        const userAns = answers.userAnswer[`detail_${i}`]?.trim().toLowerCase();
        return userAns && d.answer.toLowerCase().split(/[,(]/)[0].trim().split(" ").every(
          (word) => word.length > 2 && userAns.includes(word.toLowerCase())
        );
      });
    }
    case "map_event": {
      return answers.userAnswer["mapEvent"] === question.mapEvent!.correctAnswer;
    }
    case "map_cities": {
      return answers.userAnswer["mapCity"] === question.mapCities!.correctCity;
    }
    case "argumentation": {
      const q = question.argumentation!;
      return answers.selectedFact === q.facts[q.correctFactIndex];
    }
    case "chronology": {
      const q = question.chronology!;
      const halfOk = answers.userAnswer["half"] === q.correctHalf;
      const foreignOk = answers.foreignEvent === q.foreignEventOptions[q.correctForeignIndex];
      return halfOk && foreignOk;
    }
    case "culture_century": {
      const q = question.cultureCentury!;
      return q.correctIndices.every((idx) =>
        (answers.selectedMonuments || []).includes(q.monuments[idx])
      ) && (answers.selectedMonuments || []).length === q.correctIndices.length;
    }
    case "culture_creator": {
      const q = question.cultureCreator!;
      return answers.selectedCreator === q.creatorOptions[q.correctCreatorIndex];
    }
    case "vov": {
      const q = question.vov!;
      return answers.vovAnswer === q.options[q.correctIndex];
    }
    default: return false;
  }
}

/* ──────────────────────── RESULTS SUMMARY ──────────────────────── */

function ResultsSummary({
  answerStates,
  questions,
  onRestart,
}: {
  answerStates: Map<number, AnswerState>;
  questions: Question[];
  onRestart: () => void;
}) {
  const totalCorrect = Array.from(answerStates.values()).filter((a) => a.correct).length;
  const totalQuestions = questions.length;
  const percentage = Math.round((totalCorrect / totalQuestions) * 100);

  const grade =
    percentage >= 90 ? { label: "Отлично! 🌟", color: "text-emerald-400", emoji: "🏆" } :
    percentage >= 75 ? { label: "Хорошо!", color: "text-amber-400", emoji: "⭐" } :
    percentage >= 50 ? { label: "Удовлетворительно", color: "text-yellow-400", emoji: "📚" } :
    { label: "Нужно подтянуть", color: "text-rose-400", emoji: "💪" };

  const typeBreakdown = useMemo(() => {
    const map = new Map<QuestionType, { correct: number; total: number }>();
    questions.forEach((q) => {
      const cur = map.get(q.type) || { correct: 0, total: 0 };
      cur.total++;
      if (answerStates.get(q.id)?.correct) cur.correct++;
      map.set(q.type, cur);
    });
    return Array.from(map.entries());
  }, [answerStates, questions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Score card */}
      <Card className="bg-[#111827] border-amber-900/20 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/5 to-amber-500/20 p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-6xl mb-3"
          >
            {grade.emoji}
          </motion.div>
          <h2 className={`text-2xl font-bold ${grade.color}`}>{grade.label}</h2>
          <p className="text-gray-400 text-sm mt-1">
            Правильных ответов: {totalCorrect} из {totalQuestions}
          </p>
          <div className="mt-4 max-w-xs mx-auto">
            <Progress
              value={percentage}
              className="h-3 bg-[#0a0e18]"
            />
          </div>
          <p className="text-amber-400 text-3xl font-bold mt-2">{percentage}%</p>
        </div>
      </Card>

      {/* Type breakdown */}
      <Card className="bg-[#111827] border-amber-900/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
            <BarChart3 size={16} />
            Результаты по типам заданий
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {typeBreakdown.map(([type, data]) => {
            const meta = TYPE_META[type];
            const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            return (
              <div key={type} className="flex items-center gap-3">
                <Badge variant="outline" className={cn("shrink-0", meta.color)}>
                  {meta.icon}
                  <span className="text-[10px] ml-1">{meta.label}</span>
                </Badge>
                <div className="flex-1">
                  <div className="h-2 bg-[#0a0e18] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className={cn(
                        "h-full rounded-full",
                        pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                      )}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0 w-16 text-right">
                  {data.correct}/{data.total} ({pct}%)
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Wrong answers review */}
      {totalCorrect < totalQuestions && (
        <Card className="bg-[#111827] border-amber-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-rose-400 text-sm flex items-center gap-2">
              <XCircle size={16} />
              Ошибки — повторите материал
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.filter((q) => !answerStates.get(q.id)?.correct).map((q) => (
              <div key={q.id} className="p-3 rounded-lg bg-[#0a0e18] border border-rose-900/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-rose-400 text-xs font-bold">#{q.id}</span>
                  <QuestionTypeBadge type={q.type} />
                </div>
                <p className="text-gray-400 text-xs mt-1">{q.explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 justify-center">
        <Button onClick={onRestart} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2">
          <RotateCcw size={16} />
          Пройти заново
        </Button>
      </div>
    </motion.div>
  );
}

/* BarChart3 icon inline since we need it */
function BarChart3({ size, className }: { size?: number; className?: string }) {
  return (
    <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3v18h18" /><path d="M7 16V8" /><path d="M11 16V11" /><path d="M15 16v-3" /><path d="M19 16v-7" />
    </svg>
  );
}

/* ──────────────────────── HOME SCREEN ──────────────────────── */

function HomeScreen({ onStart }: { onStart: () => void }) {
  const typeEntries = Object.entries(TYPE_META) as [QuestionType, typeof TYPE_META[QuestionType]][];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-4"
        >
          <History size={40} className="text-amber-400" />
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
          ИСТОРИЯ EXPLORER
        </h1>
        <p className="text-gray-400 text-lg max-w-lg mx-auto">
          Интерактивный тренажёр подготовки к ВПР по истории России. 7 класс: XIV–XX века.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Target size={14} /> 24 вопроса</span>
          <span className="flex items-center gap-1"><Layers size={14} /> 10 типов заданий</span>
          <span className="flex items-center gap-1"><Clock size={14} /> Без ограничений</span>
        </div>
      </div>

      {/* Type overview */}
      <Card className="bg-[#111827] border-amber-900/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-amber-400 text-sm">Типы заданий ВПР</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {typeEntries.map(([type, meta]) => {
              const count = QUESTIONS.filter((q) => q.type === type).length;
              return (
                <div key={type} className="flex items-center gap-2 p-2 rounded-lg bg-[#0a0e18] border border-amber-900/10">
                  <Badge variant="outline" className={cn("shrink-0", meta.color)}>
                    {meta.icon}
                  </Badge>
                  <span className="text-gray-300 text-xs flex-1">{meta.label}</span>
                  <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400">{count}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Timeline preview */}
      <Card className="bg-[#111827] border-amber-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
            <Clock size={16} />
            Хронология ключевых событий
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineSVG />
        </CardContent>
      </Card>

      {/* Start button */}
      <div className="text-center pb-8">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onStart}
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold text-lg px-10 py-6 shadow-lg shadow-amber-500/25 gap-2"
          >
            <Zap size={20} />
            Начать тренировку
            <ArrowRight size={20} />
          </Button>
        </motion.div>
        <p className="text-gray-500 text-xs mt-3">Вы сможете использовать справочник во время решения</p>
      </div>
    </motion.div>
  );
}

/* ──────────────────────── MAIN COMPONENT ──────────────────────── */

export default function HistoryPractice() {
  const [screen, setScreen] = useState<Screen>("home");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<number, AnswerState>>(new Map());
  const [showSidebar, setShowSidebar] = useState(false);

  const questions = QUESTIONS;
  const currentQuestion = questions[currentIdx];
  const currentAnswer = answers.get(currentQuestion?.id) || {
    answered: false,
    correct: false,
    userAnswer: {},
  };

  const progress = answers.size / questions.length;
  const correctCount = Array.from(answers.values()).filter((a) => a.correct).length;

  const setAnswer = useCallback((key: string, value: string) => {
    setAnswers((prev) => {
      const cur = prev.get(currentQuestion.id) || {
        answered: false,
        correct: false,
        userAnswer: {},
      };
      const updated = {
        ...cur,
        userAnswer: { ...cur.userAnswer, [key]: value },
        ...(key === "selectedFact" ? { selectedFact: value } : {}),
        ...(key === "foreignEvent" ? { foreignEvent: value } : {}),
        ...(key === "selectedMonuments" ? { selectedMonuments: JSON.parse(value) } : {}),
        ...(key === "selectedCreator" ? { selectedCreator: value } : {}),
        ...(key === "vovAnswer" ? { vovAnswer: value } : {}),
        ...(key === "explanation" ? { explanation: value } : {}),
      };
      return new Map(prev).set(currentQuestion.id, updated);
    });
  }, [currentQuestion]);

  const handleSubmit = useCallback(() => {
    const answerState = answers.get(currentQuestion.id) || {
      answered: false,
      correct: false,
      userAnswer: {},
    };
    if (answerState.answered) return;

    const checked = {
      ...answerState,
      answered: true,
      correct: checkAnswer(currentQuestion, answerState),
    };
    setAnswers((prev) => new Map(prev).set(currentQuestion.id, checked));
  }, [answers, currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setScreen("results");
    }
  }, [currentIdx, questions.length]);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
    }
  }, [currentIdx]);

  const handleRestart = useCallback(() => {
    setScreen("home");
    setCurrentIdx(0);
    setAnswers(new Map());
  }, []);

  const highlightedEvent = useMemo(() => {
    if (!currentQuestion) return undefined;
    if (currentQuestion.source?.text.includes("Угре")) return "Стояние на Угре";
    if (currentQuestion.source?.text.includes("1514") || currentQuestion.source?.text.includes("Смоленск")) return "Смоленск";
    if (currentQuestion.chronology?.russianEvent.includes("1613")) return "Михаил Романов";
    if (currentQuestion.chronology?.russianEvent.includes("1552")) return "Казани";
    if (currentQuestion.chronology?.russianEvent.includes("1649")) return "Соборное уложение";
    if (currentQuestion.matchPairs?.some((p) => p.label.includes("Угре"))) return "Стояние на Угре";
    if (currentQuestion.matchPairs?.some((p) => p.label.includes("Молодях"))) return "Молодях";
    if (currentQuestion.matchPairs?.some((p) => p.label.includes("Казани"))) return "Казани";
    if (currentQuestion.vov?.question.includes("1945")) return "Победа в ВОВ";
    return undefined;
  }, [currentQuestion]);

  if (screen === "home") {
    return (
      <div className="min-h-screen bg-[#0a0e18] px-4 py-6">
        <HomeScreen onStart={() => setScreen("quiz")} />
      </div>
    );
  }

  if (screen === "results") {
    return (
      <div className="min-h-screen bg-[#0a0e18] px-4 py-6">
        <ResultsSummary answerStates={answers} questions={questions} onRestart={handleRestart} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e18] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e18]/95 backdrop-blur-md border-b border-amber-900/20 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="text-gray-400 hover:text-amber-400 shrink-0">
            <Home size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-amber-400 font-bold text-sm sm:text-base truncate">ИСТОРИЯ EXPLORER</h1>
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 shrink-0">
                ВПР
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Progress value={progress * 100} className="h-1.5 flex-1 bg-[#1f2937]" />
              <span className="text-xs text-gray-500 shrink-0">
                {answers.size}/{questions.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-1">
              <Star size={12} />
              {correctCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-gray-400 hover:text-amber-400"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <BookOpen size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Quiz area */}
          <div className="space-y-4">
            {/* Timeline */}
            <Card className="bg-[#111827] border-amber-900/20 overflow-hidden">
              <CardContent className="p-3">
                <TimelineSVG highlightedEvent={highlightedEvent} />
              </CardContent>
            </Card>

            {/* Question */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="bg-[#111827] border-amber-900/20 overflow-hidden">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded">#{currentQuestion.id}</span>
                        <QuestionTypeBadge type={currentQuestion.type} />
                      </div>
                      <span className="text-gray-500 text-xs">
                        {currentIdx + 1} из {questions.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <QuestionRenderer
                      question={currentQuestion}
                      answers={currentAnswer}
                      setAnswer={setAnswer}
                    />

                    {/* Hint */}
                    <div className="mt-4">
                      <HintCard hint={currentQuestion.hint} />
                    </div>

                    {/* Feedback */}
                    <AnimatePresence>
                      {currentAnswer.answered && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <FeedbackBadge correct={currentAnswer.correct} />
                          </div>
                          <div className="p-3 rounded-lg bg-[#0a0e18] border border-amber-900/20">
                            <p className="text-xs text-amber-500 mb-1 flex items-center gap-1">
                              <Lightbulb size={12} />
                              Пояснение
                            </p>
                            <p className="text-gray-300 text-sm leading-relaxed">{currentQuestion.explanation}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentIdx === 0}
                className="border-amber-900/20 text-gray-400 hover:text-amber-400 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Назад</span>
              </Button>

              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60%]">
                {questions.map((q, i) => {
                  const ans = answers.get(q.id);
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(i)}
                      className={cn(
                        "w-7 h-7 rounded-full text-[10px] font-bold transition-all shrink-0",
                        i === currentIdx && "ring-2 ring-amber-400 ring-offset-1 ring-offset-[#0a0e18] bg-amber-500/30 text-amber-300",
                        ans?.correct && i !== currentIdx && "bg-emerald-500/30 text-emerald-400",
                        ans && !ans.correct && i !== currentIdx && "bg-rose-500/30 text-rose-400",
                        !ans && i !== currentIdx && "bg-[#1f2937] text-gray-500 hover:bg-[#374151]"
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              {!currentAnswer.answered ? (
                <Button
                  onClick={handleSubmit}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1 shrink-0"
                >
                  <CheckCircle2 size={16} />
                  <span className="hidden sm:inline">Проверить</span>
                </Button>
              ) : (
                <Button onClick={handleNext} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1 shrink-0">
                  {currentIdx < questions.length - 1 ? (
                    <>
                      <span className="hidden sm:inline">Далее</span>
                      <ChevronRight size={16} />
                    </>
                  ) : (
                    <>
                      <Trophy size={16} />
                      <span className="hidden sm:inline">Результаты</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className={cn(
            "lg:block",
            showSidebar ? "block" : "hidden"
          )}>
            <div className="lg:sticky lg:top-[72px]">
              <ReferenceSidebar currentQuestion={currentQuestion} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
