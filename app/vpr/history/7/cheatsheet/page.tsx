"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award, Brain, ChevronRight, ChevronLeft, Clock, MapPin, Palette, Globe,
  Crown, Swords, Sparkles, CheckCircle2, XCircle, HelpCircle, Star,
  ArrowRight, RotateCcw, Target, Lightbulb, Shield, Scroll, Landmark,
  Flag, Calendar, FileText, Users, Wrench, History, ChevronDown, BookOpen, Zap, Trophy,
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

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

type QuestionType =
  | "matching" | "source_who_when" | "source_details" | "map_event"
  | "map_cities" | "argumentation" | "chronology"
  | "culture_century" | "culture_creator" | "vov";

interface MatchPair { id: string; label: string; correctAnswer: string; }
interface SourceQuestion { text: string; personAnswer: string; yearAnswer: string; details?: { question: string; answer: string }[]; }
interface MapEventQ { description: string; correctAnswer: string; options: string[]; }
interface MapCitiesQ { description: string; correctCity: string; options: string[]; }
interface ArgumentationQ { viewpoint: string; facts: string[]; correctFactIndex: number; }
interface ChronologyQ { russianEvent: string; correctHalf: string; foreignEventOptions: string[]; correctForeignIndex: number; }
interface CultureCenturyQ { century: string; monuments: string[]; correctIndices: number[]; }
interface CultureCreatorQ { monument: string; creatorOptions: string[]; correctCreatorIndex: number; }
interface VovQ { question: string; options: string[]; correctIndex: number; }

interface Question {
  id: number; type: QuestionType; typeName: string; typeIcon: string;
  matchPairs?: MatchPair[]; source?: SourceQuestion; mapEvent?: MapEventQ;
  mapCities?: MapCitiesQ; argumentation?: ArgumentationQ; chronology?: ChronologyQ;
  cultureCentury?: CultureCenturyQ; cultureCreator?: CultureCreatorQ; vov?: VovQ;
  hint: string; explanation: string;
}

interface AnswerState {
  answered: boolean; correct: boolean; userAnswer: Record<string, string>;
  selectedFact?: string; foreignEvent?: string; selectedMonuments?: string[];
  selectedCreator?: string; vovAnswer?: string; explanation?: string;
}

/* ─── Reference data types ─── */

type Ruler = { id: string; name: string; years: string; halfCentury: string; headline: string; keyEvents: string[]; examPairs: string[]; trap: string; };
type TimelineEvent = { year: string; event: string; rulerId: string; whyItMatters: string; };
type CultureBlock = { century: string; items: string[]; };
type ForeignBlock = { period: string; events: string[]; };
type Treaty = { year: string; name: string; result: string; opponent: string; };
type Drill = { id: number; type: string; question: string; answer: string; why: string; };

/* ═══════════════════════════════════════════════════════════════════
   QUESTION DATA — 24 questions, 10 types
   ═══════════════════════════════════════════════════════════════════ */

const QUESTIONS: Question[] = [
  { id:1, type:"matching", typeName:"Соответствие", typeIcon:"layers",
    matchPairs:[
      {id:"a",label:"А. Битва при Молодях",correctAnswer:"Воротынский"},
      {id:"b",label:"Б. Введение урочных лет",correctAnswer:"Фёдор Иоаннович"},
      {id:"c",label:"В. Взятие Казани",correctAnswer:"Иван IV Грозный"},
    ], hint:"Подумай: кто командовал войсками, кто был царём, кто издавал указы?",
    explanation:"Михаил Воротынский — полководец, разгромивший Девлет Гирея в 1572 г. Фёдор Иоаннович — царь, при котором в 1597 г. введены урочные лета. Иван IV Грозный — царь, под командованием которого в 1552 г. была взята Казань.",
  },
  { id:2, type:"matching", typeName:"Соответствие", typeIcon:"layers",
    matchPairs:[
      {id:"a",label:"А. Стояние на р. Угре",correctAnswer:"Иван III"},
      {id:"b",label:"Б. Освобождение Москвы ополчением",correctAnswer:"Минин и Пожарский"},
      {id:"c",label:"В. Церковный раскол",correctAnswer:"Алексей Михайлович"},
    ], hint:"Свяжи событие с правителем, при котором оно произошло.",
    explanation:"Иван III — стояние на реке Угре в 1480 г. Минин и Пожарский — руководители Второго ополчения, освободившего Москву в 1612 г. Алексей Михайлович — при нём состоялся церковный раскол.",
  },
  { id:3, type:"matching", typeName:"Соответствие", typeIcon:"layers",
    matchPairs:[
      {id:"a",label:"А. Куликовская битва",correctAnswer:"Дмитрий Донской"},
      {id:"b",label:"Б. Учреждение патриаршества",correctAnswer:"Фёдор Иоаннович"},
      {id:"c",label:"В. Соборное уложение",correctAnswer:"Алексей Михайлович"},
    ], hint:"Дмитрий Донской — битва на Куликовом поле, Фёдор — патриаршество, Алексей — Соборное уложение.",
    explanation:"Дмитрий Донской разбил Мамая на Куликовом поле в 1380 г. Фёдор Иоаннович учредил патриаршество в России в 1589 г. Алексей Михайлович принял Соборное уложение в 1649 г.",
  },
  { id:4, type:"source_who_when", typeName:"Источник: кто и когда", typeIcon:"scroll",
    source:{ text:"В лето 7022 (1514) великий князь Василий Иванович взял град Смоленск, который был под властью Литвы более ста лет.", personAnswer:"Василий III", yearAnswer:"1514" },
    hint:"Кто был великим князем в начале XVI века? Какой год указан в летописной дате 7022?",
    explanation:"7022 − 5508 = 1514. Великий князь Василий Иванович — это Василий III (1505–1533).",
  },
  { id:5, type:"source_who_when", typeName:"Источник: кто и когда", typeIcon:"scroll",
    source:{ text:"Того же лета (6988) князь великий Иван Васильевич и царь Ахмат стояли на реке на Угре. Царь не перешёл реку и отошёл.", personAnswer:"Иван III", yearAnswer:"1480" },
    hint:"6988 − 5508 = ? Какой великий князь носил имя Иван Васильевич в конце XV века?",
    explanation:"6988 − 5508 = 1480. Иван Васильевич — это Иван III (1462–1505).",
  },
  { id:6, type:"source_details", typeName:"Источник: детали", typeIcon:"file-text",
    source:{ text:"В лето 7022 (1514) великий князь Василий Иванович взял град Смоленск, который был под властью Литвы более ста лет.",
      details:[{question:"Какой город был возвращён?",answer:"Смоленск"},{question:"Под властью кого он был?",answer:"Литвы (Великого княжества Литовского)"}] },
    hint:"Перечитай текст внимательно — ответы прямо в нём.",
    explanation:"Из текста прямо следует, что город Смоленск был под властью Литвы и был возвращён в состав Русского государства.",
  },
  { id:7, type:"source_details", typeName:"Источник: детали", typeIcon:"file-text",
    source:{ text:"В 1552 году царь Иван IV лично участвовал в походе на Казанское ханство. После длительной осады город пал, и ханство было присоединено к России.",
      details:[{question:"Какое ханство было присоединено?",answer:"Казанское ханство"},{question:"Какой храм построили в память о победе?",answer:"Храм Василия Блаженного (Покровский собор)"}] },
    hint:"Храм на Красной площади с разноцветными куполами — один из символов Москвы.",
    explanation:"Казанское ханство присоединено в 1552 г. Храм Василия Блаженного построен в честь победы.",
  },
  { id:8, type:"map_event", typeName:"Карта: событие", typeIcon:"map",
    mapEvent:{ description:"На карте изображены территории Поволжья: Волга от Казани до Астрахани, отмечены города Царицын, Симбирск, Саратов. Красными стрелками показано движение восставших по Волге. 1670-1671 гг.",
      correctAnswer:"Восстание Степана Разина", options:["Восстание Степана Разина","Крестьянская война Е. Пугачёва","Смутное время","Ливонская война"] },
    hint:"Восстание в Поволжье в 1670-1671 гг. — кто им руководил?",
    explanation:"Восстание Степана Разина (1670-1671) проходило в Поволжье. Отличается от восстания Пугачёва (1773-1775).",
  },
  { id:9, type:"map_event", typeName:"Карта: событие", typeIcon:"map",
    mapEvent:{ description:"На карте изображена территория России начала XVII века. Стрелками показано движение польских и шведских войск. Отмечены города: Москва, Смоленск, Новгород.",
      correctAnswer:"Смутное время", options:["Смутное время","Ливонская война","Куликовская битва","Восстание Разина"] },
    hint:"Начало XVII века — период, когда в России не было законного царя.",
    explanation:"Смутное время (1598-1613) — иностранные войска на территории России. Второе ополчение шло из Нижнего Новгорода на Москву.",
  },
  { id:10, type:"map_cities", typeName:"Карта: города", typeIcon:"compass",
    mapCities:{ description:"На исторической карте восстания Степана Разина (1670-1671) отмечен город, расположенный на Волге при впадении в неё реки Царицы.",
      correctCity:"Царицын", options:["Царицын","Азовор","Тамбов","Елец"] },
    hint:"Город назван по названию реки Царицы, притока Волги. Сейчас он носит другое имя.",
    explanation:"Царицын (ныне Волгоград) расположен на Волге при впадении реки Царицы.",
  },
  { id:11, type:"map_cities", typeName:"Карта: города", typeIcon:"compass",
    mapCities:{ description:"На карте Ливонской войны (1558-1583) отмечен город-крепость на западной границе, который героически оборонялся от войск Стефана Батория.",
      correctCity:"Псков", options:["Псков","Смоленск","Новгород","Казань"] },
    hint:"Город на западе России, который героически оборонялся от войск Батория и не был взят.",
    explanation:"Псков — ключевой город на западной границе. В 1581 г. польско-литовские войска Батория осадили Псков, но город выдержал осаду.",
  },
  { id:12, type:"argumentation", typeName:"Аргументация", typeIcon:"brain",
    argumentation:{ viewpoint:"Внешняя политика Ивана IV Грозного была успешной",
      facts:["Битва при Молодях (1572 г.) — разгром войск Девлет Гирея","Введение опричнины (1565 г.) — внутренний террор","Ливонская война (1558-1583) — неудачная война","Присоединение Казанского ханства (1552 г.)"],
      correctFactIndex:0 },
    hint:"Выбери факт, который РЕАЛЬНО подтверждает успех во внешней политике. Опричнина — внутреннее дело!",
    explanation:"Битва при Молодях — успешный разгром крымских войск, предотвращший угрозу Москве.",
  },
  { id:13, type:"argumentation", typeName:"Аргументация", typeIcon:"brain",
    argumentation:{ viewpoint:"Правление Ивана III стало переломным в истории России",
      facts:["Создание Избранной рады","Стояние на реке Угре (1480 г.) — окончательное свержение ордынского ига","Церковный раскол при патриархе Никоне","Восстание Степана Разина"],
      correctFactIndex:1 },
    hint:"Иван III правил в конце XV века. Событие 1480 года стало важнейшим в его правлении.",
    explanation:"Стояние на реке Угре (1480 г.) привело к окончательному свержению ордынского ига.",
  },
  { id:14, type:"argumentation", typeName:"Аргументация", typeIcon:"brain",
    argumentation:{ viewpoint:"Избрание Михаила Романова стало концом Смутного времени",
      facts:["Введение урочных лет (1597 г.)","Земский собор 1613 года избрал Михаила Фёдоровича Романова на царство","Соборное уложение (1649 г.)","Основание Московского университета (1755 г.)"],
      correctFactIndex:1 },
    hint:"Что произошло в 1613 году, когда Смутное время подошло к концу?",
    explanation:"Земский собор 1613 года избрал Михаила Фёдоровича Романова на царство — начало династии Романовых.",
  },
  { id:15, type:"chronology", typeName:"Хронология", typeIcon:"calendar",
    chronology:{ russianEvent:"Избрание Михаила Романова на царство (1613 г.)", correctHalf:"Первая половина XVII века",
      foreignEventOptions:["Тридцатилетняя война (1618-1648)","Английская революция (1640-1660)","Подписание Утрехтской унии (1579)","Славная революция в Англии (1688)"], correctForeignIndex:0 },
    hint:"1613 г. — это первая половина XVII века. Какое зарубежное событие также происходило в первой половине XVII века?",
    explanation:"Тридцатилетняя война (1618-1648) — масштабный европейский конфликт первой половины XVII века.",
  },
  { id:16, type:"chronology", typeName:"Хронология", typeIcon:"calendar",
    chronology:{ russianEvent:"Взятие Казани Иваном IV (1552 г.)", correctHalf:"Вторая половина XVI века",
      foreignEventOptions:["Реформация и начало протестантизма","Подписание Утрехтской унии (1579)","Тридцатилетняя война (1618-1648)","Великие географические открытия Колумба (1492)"], correctForeignIndex:1 },
    hint:"1552 г. — вторая половина XVI века. Утрехтская уния 1579 г. — тоже XVI век.",
    explanation:"Утрехтская уния (1579) объединила северные провинции Нидерландов во второй половине XVI века.",
  },
  { id:17, type:"chronology", typeName:"Хронология", typeIcon:"calendar",
    chronology:{ russianEvent:"Соборное уложение Алексея Михайловича (1649 г.)", correctHalf:"Вторая половина XVII века",
      foreignEventOptions:["Тридцатилетняя война (1618-1648)","Славная революция в Англии (1688)","Реформация (начало XVI в.)","Великие географические открытия (конец XV в.)"], correctForeignIndex:1 },
    hint:"1649 г. — вторая половина XVII века. Какое событие произошло в Англии в 1688 году?",
    explanation:"Славная революция в Англии (1688) произошла во второй половине XVII века.",
  },
  { id:18, type:"culture_century", typeName:"Культура: век", typeIcon:"palette",
    cultureCentury:{ century:"XVI век",
      monuments:["«Великие Четьи-Минеи» (сборник житий святых)","«Синопсис» (первый учебник русской истории)","Храм Василия Блаженного","Теремной дворец в Московском Кремле"], correctIndices:[0,2] },
    hint:"«Великие Четьи-Минеи» — труд митрополита Макария (XVI в.). Храм Василия Блаженного — XVI в.",
    explanation:"«Великие Четьи-Минеи» и Храм Василия Блаженного относятся к XVI веку. «Синопсис» и Теремной дворец — XVII век.",
  },
  { id:19, type:"culture_century", typeName:"Культура: век", typeIcon:"palette",
    cultureCentury:{ century:"XVII век",
      monuments:["«Домострой» (свод правил поведения)","«Калязинская челобитная»","Парсуна «Патриарх Никон с клиром»","Стоглав"], correctIndices:[1,2] },
    hint:"«Домострой» и Стоглав — XVI век. «Калязинская челобитная» и парсуна — XVII век.",
    explanation:"«Калязинская челобитная» и парсуна «Патриарх Никон с клиром» относятся к XVII веку.",
  },
  { id:20, type:"culture_creator", typeName:"Культура: автор", typeIcon:"book-marked",
    cultureCreator:{ monument:"«Великие Четьи-Минеи» (многочисленный свод житий святых)",
      creatorOptions:["Митрополит Макарий","Протопоп Аввакум","Патриарх Никон","Сильвестр (священник Благовещенского собора)"], correctCreatorIndex:0 },
    hint:"Этот церковный иерарх при Иване IV собирал жития святых.",
    explanation:"«Великие Четьи-Минеи» составлены по инициативе митрополита Макария в середине XVI века.",
  },
  { id:21, type:"culture_creator", typeName:"Культура: автор", typeIcon:"book-marked",
    cultureCreator:{ monument:"«Домострой» (свод правил семейной и хозяйственной жизни)",
      creatorOptions:["Митрополит Макарий","Протопоп Аввакум","Священник Сильвестр (или кто-то из его окружения)","Патриарх Иов"], correctCreatorIndex:2 },
    hint:"Этот священник был членом Избранной рады и духовником молодого Ивана IV.",
    explanation:"«Домострой» традиционно приписывается священнику Сильвестру, духовнику Ивана IV Грозного.",
  },
  { id:22, type:"vov", typeName:"ВОВ", typeIcon:"shield",
    vov:{ question:"В каком году закончилась Великая Отечественная война?", options:["1943","1944","1945","1946"], correctIndex:2 },
    hint:"Вспомни дату капитуляции Германии — май...",
    explanation:"Великая Отечественная война закончилась 9 мая 1945 года с капитуляцией нацистской Германии.",
  },
  { id:23, type:"vov", typeName:"ВОВ", typeIcon:"shield",
    vov:{ question:"Что означает День Победы в истории России?", options:["Победа в Северной войне со Швецией","Победа СССР в Великой Отечественной войне над фашистской Германией","Победа в Крымской войне","Окончание Гражданской войны"], correctIndex:1 },
    hint:"День Победы — 9 мая — это праздник в память о победе в самой кровопролитной войне XX века.",
    explanation:"День Победы (9 мая) — день победы СССР в ВОВ (1941-1945) над фашистской Германией.",
  },
  { id:24, type:"vov", typeName:"ВОВ", typeIcon:"shield",
    vov:{ question:"Какое событие произошло в Сталинграде в 1943 году?", options:["Капитуляция Германии","Разгром немецко-фашистских войск — коренной перелом","Начало войны с Японией","Блокада Ленинграда"], correctIndex:1 },
    hint:"Сталинградская битва — одно из самых значимых сражений, после которого инициатива перешла к Красной Армии.",
    explanation:"Сталинградская битва завершилась разгромом немецко-фашистских войск в феврале 1943 года.",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   REFERENCE DATA (from ChatGPT enhanced version)
   ═══════════════════════════════════════════════════════════════════ */

const RULERS: Ruler[] = [
  { id:"ivan3", name:"Иван III", years:"1462–1505", halfCentury:"конец XV века", headline:"Собирает земли вокруг Москвы и ломает зависимость от Орды.", keyEvents:["Стояние на реке Угре (1480)","Конец ордынского ига","Укрепление Москвы"], examPairs:["1480 → Иван III","Угра → конец ига","объединение земель → Иван III"], trap:"Не путай с Иваном IV: Иван III — это конец XV века, а не опричнина." },
  { id:"vasily3", name:"Василий III", years:"1505–1533", halfCentury:"первая половина XVI века", headline:"Продолжает объединение и возвращает Смоленск.", keyEvents:["Присоединение Пскова (1510)","Взятие Смоленска (1514)","Присоединение Рязани (1521)"], examPairs:["1514 → Смоленск","Смоленск → Василий III","первое крупное внешнеполитическое усиление XVI века"], trap:"Если в источнике есть Смоленск 1514 года, почти всегда ищи Василия III." },
  { id:"ivan4", name:"Иван IV Грозный", years:"1533–1584", halfCentury:"вторая половина XVI века", headline:"Самый экзаменационный царь: Казань, опричнина, Ливонская война, Молоди.", keyEvents:["Взятие Казани (1552)","Стрельцы (1550)","Опричнина (1565–1572)","Битва при Молодях (1572)","Ливонская война (1558–1583)"], examPairs:["1552 → Казань","1572 → Молоди","опричнина → Иван IV","битва при Молодях → Воротынский"], trap:"Опричнина — это внутреннее дело. Для аргумента о внешней политике лучше брать Молодинскую битву." },
  { id:"fedor1", name:"Фёдор Иоаннович", years:"1584–1598", halfCentury:"конец XVI века", headline:"При нём оформляются церковные и крестьянские важные изменения.", keyEvents:["Учреждение патриаршества (1589)","Урочные лета (1597)","Правление идёт к Смуте"], examPairs:["1597 → урочные лета","1589 → патриаршество","урочные лета → Фёдор Иоаннович"], trap:"Если спрашивают урочные лета, ответ почти всегда связан с Фёдором Иоанновичем и Борисом Годуновым." },
  { id:"godunov", name:"Борис Годунов", years:"1598–1605", halfCentury:"переход к XVII веку", headline:"Начало Смутного времени и борьба за устойчивость государства.", keyEvents:["Начало Смутного времени","Строительство крепостей","Проблемы династии"], examPairs:["Смута → Борис Годунов","крепости → Борис Годунов","кризис власти → конец XVI / начало XVII века"], trap:"Годунов нужен для вопросов о начале Смуты, но не для стояния на Угре и не для Ливонской войны." },
  { id:"mikhail", name:"Михаил Романов", years:"1613–1645", halfCentury:"первая половина XVII века", headline:"Символ выхода из Смуты и начало новой династии.", keyEvents:["Избрание на царство (1613)","Начало династии Романовых","Стабилизация после Смуты"], examPairs:["1613 → Михаил Романов","первая половина XVII века → Михаил Романов","Смутное время → 1613"], trap:"Если в задании просят половину века для 1613 года, это первая половина XVII века, без сомнений." },
  { id:"alexei", name:"Алексей Михайлович", years:"1645–1676", halfCentury:"вторая половина XVII века", headline:"Соборное уложение, церковный раскол, восстание Разина.", keyEvents:["Соборное уложение (1649)","Церковный раскол (1650-е)","Восстание Степана Разина (1670–1671)"], examPairs:["1649 → Соборное уложение","Никон → церковный раскол","Разин → вторая половина XVII века"], trap:"Для типа 7 и культуры XVII века этот царь встречается очень часто: учи его без суеты." },
];

const TIMELINE: TimelineEvent[] = [
  { year:"1480", event:"Стояние на Угре", rulerId:"ivan3", whyItMatters:"Фактический конец ордынского ига." },
  { year:"1514", event:"Взятие Смоленска", rulerId:"vasily3", whyItMatters:"Смоленск возвращён Русскому государству." },
  { year:"1552", event:"Взятие Казани", rulerId:"ivan4", whyItMatters:"Казанское ханство присоединено к России." },
  { year:"1565", event:"Начало опричнины", rulerId:"ivan4", whyItMatters:"Внутриполитический перелом при Иване IV." },
  { year:"1572", event:"Битва при Молодях", rulerId:"ivan4", whyItMatters:"Разгром войск Девлет-Гирея." },
  { year:"1589", event:"Учреждение патриаршества", rulerId:"fedor1", whyItMatters:"Первый патриарх — Иов." },
  { year:"1597", event:"Урочные лета", rulerId:"fedor1", whyItMatters:"Ограничение поиска беглых крестьян." },
  { year:"1613", event:"Избрание Михаила Романова", rulerId:"mikhail", whyItMatters:"Конец Смуты и старт новой династии." },
  { year:"1649", event:"Соборное уложение", rulerId:"alexei", whyItMatters:"Ключевой свод законов XVII века." },
  { year:"1654", event:"Церковный раскол", rulerId:"alexei", whyItMatters:"Реформы патриарха Никона." },
  { year:"1670–1671", event:"Восстание Разина", rulerId:"alexei", whyItMatters:"Крупнейшее восстание XVII века." },
  { year:"1945", event:"Победа в Великой Отечественной войне", rulerId:"alexei", whyItMatters:"Нужна для типа 10 и памяти о подвиге." },
];

const CULTURE: CultureBlock[] = [
  { century:"XVI век", items:["«Великие Четьи-Минеи» — митрополит Макарий","Храм Василия Блаженного","«Домострой»","Стоглав (1551)"] },
  { century:"XVII век", items:["«Калязинская челобитная»","Теремной дворец Московского Кремля","Парсуна","«Синопсис»"] },
];

const FOREIGN: ForeignBlock[] = [
  { period:"Первая половина XVI века", events:["Начало Реформации (1517)","Завоевания Кортеса и Писарро"] },
  { period:"Вторая половина XVI века", events:["Нидерландская революция","Разгром Непобедимой армады (1588)"] },
  { period:"Первая половина XVII века", events:["Тридцатилетняя война (1618–1648)","Английская революция (1640)"] },
  { period:"Вторая половина XVII века", events:["Славная революция в Англии (1688)","Укрепление власти Людовика XIV"] },
];

const TREATIES: Treaty[] = [
  { year:"1582", name:"Ям-Запольский мир", result:"Россия теряет успехи в Ливонии", opponent:"Польша" },
  { year:"1583", name:"Плюсский мир", result:"Потеря Нарвы и выхода к Балтике", opponent:"Швеция" },
  { year:"1617", name:"Столбовский мир", result:"Россия теряет Балтийское побережье", opponent:"Швеция" },
  { year:"1618", name:"Деулинское перемирие", result:"Смоленск остаётся за Польшей", opponent:"Польша" },
  { year:"1634", name:"Поляновский мир", result:"Возврат части городов, но не Смоленска", opponent:"Польша" },
  { year:"1667", name:"Андрусовское перемирие", result:"Смоленск и Левобережная Украина за Россией", opponent:"Польша" },
];

const DRILLS: Drill[] = [
  { id:1, type:"Тип 1 — соответствие", question:"Битва при Молодях → кто?", answer:"М.И. Воротынский", why:"Он руководил земским войском и разбил Девлет-Гирея в 1572 году." },
  { id:2, type:"Тип 2 — источник", question:"«Взял град Смоленск» → кто?", answer:"Василий III", why:"Смоленск был взят в 1514 году в правление Василия III." },
  { id:3, type:"Тип 6 — аргументация", question:"«Внешняя политика Ивана IV была успешной» → какой факт брать?", answer:"Битва при Молодях", why:"Это реальный успех против Крымского ханства." },
  { id:4, type:"Тип 7 — половина века", question:"1613 год → какая половина века?", answer:"Первая половина XVII века", why:"1613 — это годы 1601–1650." },
  { id:5, type:"Тип 8/9 — культура", question:"Кто связан с «Великими Четьи-Минеи»?", answer:"Митрополит Макарий", why:"Именно он связан с созданием этого памятника культуры XVI века." },
  { id:6, type:"Тип 10 — ВОВ", question:"Когда закончилась Великая Отечественная война?", answer:"1945", why:"Победа была достигнута 9 мая 1945 года." },
];

const EXAM_TRAPS = [
  { title:"Смоленск 1514", text:"Если видишь Смоленск и Василия Ивановича — это Василий III, а не Иван IV." },
  { title:"Урочные лета", text:"Введение урочных лет = 1597 год, Фёдор Иоаннович, иногда рядом всплывает Борис Годунов." },
  { title:"Молоди", text:"Битва при Молодях — М.И. Воротынский. Это полезно и для карты, и для аргументации." },
  { title:"Михаил Романов", text:"1613 год всегда толкает к первой половине XVII века и концу Смутного времени." },
];

/* ═══════════════════════════════════════════════════════════════════
   TYPE META
   ═══════════════════════════════════════════════════════════════════ */

function BarChart3Icon({ size, className }: { size?: number; className?: string }) {
  return (
    <svg width={size||16} height={size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3v18h18" /><path d="M7 16V8" /><path d="M11 16V11" /><path d="M15 16v-3" /><path d="M19 16v-7" />
    </svg>
  );
}

const TYPE_META: Record<QuestionType, { label: string; icon: React.ReactNode; color: string }> = {
  matching:          { label:"Соответствие",         icon:<Users size={16} />,       color:"bg-amber-500/20 text-amber-400 border-amber-500/30" },
  source_who_when:   { label:"Источник: кто и когда", icon:<Scroll size={16} />,      color:"bg-blue-500/20 text-blue-400 border-blue-500/30" },
  source_details:    { label:"Источник: детали",      icon:<FileText size={16} />,    color:"bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  map_event:         { label:"Карта: событие",        icon:<MapPin size={16} />,      color:"bg-green-500/20 text-green-400 border-green-500/30" },
  map_cities:        { label:"Карта: города",         icon:<Landmark size={16} />,    color:"bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  argumentation:     { label:"Аргументация",          icon:<Brain size={16} />,       color:"bg-purple-500/20 text-purple-400 border-purple-500/30" },
  chronology:        { label:"Хронология",            icon:<Calendar size={16} />,     color:"bg-rose-500/20 text-rose-400 border-rose-500/30" },
  culture_century:   { label:"Культура: век",         icon:<Palette size={16} />,      color:"bg-pink-500/20 text-pink-400 border-pink-500/30" },
  culture_creator:   { label:"Культура: автор",       icon:<BookOpen size={16} />,     color:"bg-orange-500/20 text-orange-400 border-orange-500/30" },
  vov:               { label:"ВОВ",                  icon:<Shield size={16} />,      color:"bg-red-500/20 text-red-400 border-red-500/30" },
};

/* ═══════════════════════════════════════════════════════════════════
   CHECK ANSWERS
   ═══════════════════════════════════════════════════════════════════ */

function checkAnswer(q: Question, a: AnswerState): boolean {
  switch (q.type) {
    case "matching": return (q.matchPairs||[]).every(p => a.userAnswer[p.id] === p.correctAnswer);
    case "source_who_when": { const s=q.source!; return a.userAnswer["person"]?.trim().toLowerCase().includes(s.personAnswer.toLowerCase()) && a.userAnswer["year"]?.trim()===s.yearAnswer; }
    case "source_details": { return (q.source?.details||[]).every((d,i) => { const u=a.userAnswer[`detail_${i}`]?.trim().toLowerCase(); return u && d.answer.toLowerCase().split(/[,(]/)[0].trim().split(" ").every(w=>w.length>2&&u.includes(w.toLowerCase())); }); }
    case "map_event": return a.userAnswer["mapEvent"]===q.mapEvent!.correctAnswer;
    case "map_cities": return a.userAnswer["mapCity"]===q.mapCities!.correctCity;
    case "argumentation": return a.selectedFact===q.argumentation!.facts[q.argumentation!.correctFactIndex];
    case "chronology": { const c=q.chronology!; return a.userAnswer["half"]===c.correctHalf && a.foreignEvent===c.foreignEventOptions[c.correctForeignIndex]; }
    case "culture_century": { const c=q.cultureCentury!; return c.correctIndices.every(idx=>(a.selectedMonuments||[]).includes(c.monuments[idx])) && (a.selectedMonuments||[]).length===c.correctIndices.length; }
    case "culture_creator": return a.selectedCreator===q.cultureCreator!.creatorOptions[q.cultureCreator!.correctCreatorIndex];
    case "vov": return a.vovAnswer===q.vov!.options[q.vov!.correctIndex];
    default: return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   QUIZ QUESTION COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const m = TYPE_META[type];
  return <Badge variant="outline" className={cn("gap-1 text-xs font-medium", m.color)}>{m.icon} {m.label}</Badge>;
}

function FeedbackBadge({ correct }: { correct: boolean }) {
  return (
    <motion.div initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium", correct?"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30":"bg-rose-500/20 text-rose-400 border border-rose-500/30")}>
      {correct ? <><CheckCircle2 size={18} /> Правильно!</> : <><XCircle size={18} /> Неверно</>}
    </motion.div>
  );
}

function HintCard({ hint }: { hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 gap-1" onClick={()=>setShow(!show)}>
        <Lightbulb size={14} />{show?"Скрыть подсказку":"Показать подсказку"}
      </Button>
      <AnimatePresence>{show&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300/80 text-sm">💡 {hint}</div></motion.div>}</AnimatePresence>
    </div>
  );
}

function MatchingQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const pairs = q.matchPairs!;
  const options = useMemo(()=>{const all=[...new Set(pairs.map(p=>p.correctAnswer))];const extras=["Минин и Пожарский","Борис Годунов","Дмитрий Донской"];while(all.length<5){const e=extras.find(x=>!all.includes(x));if(e)all.push(e);else break;}return all.sort(()=>Math.random()-0.5);},[pairs]);
  return (<div className="space-y-4"><p className="text-gray-300 text-sm">Установите соответствие между событиями и их участниками:</p><div className="grid gap-3">{pairs.map(pair=>(<div key={pair.id} className="flex flex-col sm:flex-row sm:items-center gap-2"><span className="text-amber-300 text-sm font-medium min-w-[200px] bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-900/20">{pair.label}</span><div className="flex gap-1.5 flex-wrap">{options.map(opt=>{const isSel=a.userAnswer[pair.id]===opt;const isCor=a.answered&&opt===pair.correctAnswer;const isWrg=a.answered&&isSel&&opt!==pair.correctAnswer;return(<motion.button key={opt} whileHover={{scale:1.03}} whileTap={{scale:0.97}} disabled={a.answered} onClick={()=>sa(pair.id,opt)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",isSel&&!a.answered&&"bg-amber-500/30 text-amber-300 border-amber-500/50",isCor&&"bg-emerald-500/30 text-emerald-300 border-emerald-500/50 ring-2 ring-emerald-500/30",isWrg&&"bg-rose-500/30 text-rose-300 border-rose-500/50",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-amber-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div>))}</div></div>);
}

function SourceWhoWhenQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const src=q.source!;
  return (<div className="space-y-4"><div className="p-4 rounded-lg bg-[#0a0e18] border border-amber-900/20"><p className="text-xs text-amber-500 mb-2 flex items-center gap-1"><Scroll size={12} /> Исторический источник</p><p className="text-gray-300 text-sm leading-relaxed italic">{src.text}</p></div><div className="grid sm:grid-cols-2 gap-3"><div><label className="text-xs text-gray-400 mb-1 block">О каком человеке идёт речь?</label><Input value={a.userAnswer["person"]||""} onChange={e=>sa("person",e.target.value)} disabled={a.answered} placeholder="Введите имя..." className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm h-10"/>{a.answered&&<motion.p initial={{opacity:0}} animate={{opacity:1}} className={cn("text-xs mt-1",a.userAnswer["person"]?.trim().toLowerCase().includes(src.personAnswer.toLowerCase())?"text-emerald-400":"text-rose-400")}>Ответ: {src.personAnswer}</motion.p>}</div><div><label className="text-xs text-gray-400 mb-1 block">Укажите год:</label><Input value={a.userAnswer["year"]||""} onChange={e=>sa("year",e.target.value)} disabled={a.answered} placeholder="Например: 1480" className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm h-10"/>{a.answered&&<motion.p initial={{opacity:0}} animate={{opacity:1}} className={cn("text-xs mt-1",a.userAnswer["year"]?.trim()===src.yearAnswer?"text-emerald-400":"text-rose-400")}>Ответ: {src.yearAnswer}</motion.p>}</div></div></div>);
}

function SourceDetailsQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const src=q.source!;
  return (<div className="space-y-4"><div className="p-4 rounded-lg bg-[#0a0e18] border border-amber-900/20"><p className="text-xs text-cyan-500 mb-2 flex items-center gap-1"><Scroll size={12} /> Исторический источник</p><p className="text-gray-300 text-sm leading-relaxed italic">{src.text}</p></div><div className="space-y-3">{(src.details||[]).map((d,i)=>(<div key={i}><label className="text-xs text-gray-400 mb-1 block">{d.question}</label><Input value={a.userAnswer[`detail_${i}`]||""} onChange={e=>sa(`detail_${i}`,e.target.value)} disabled={a.answered} placeholder="Введите ответ..." className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm h-10"/>{a.answered&&<motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-xs mt-1 text-amber-400">Ответ: {d.answer}</motion.p>}</div>))}</div></div>);
}

function MapEventQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const mq=q.mapEvent!;
  return (<div className="space-y-4"><div className="p-4 rounded-lg bg-[#0a0e18] border border-green-900/20"><p className="text-xs text-green-500 mb-2 flex items-center gap-1"><MapPin size={12} /> Описание карты</p><p className="text-gray-300 text-sm leading-relaxed">{mq.description}</p></div><div className="space-y-2"><p className="text-xs text-gray-400">Какое событие изображено на карте?</p><div className="grid gap-2">{mq.options.map(opt=>{const isSel=a.userAnswer["mapEvent"]===opt;const isCor=a.answered&&opt===mq.correctAnswer;const isWrg=a.answered&&isSel&&opt!==mq.correctAnswer;return(<motion.button key={opt} whileHover={{scale:1.01}} whileTap={{scale:0.99}} disabled={a.answered} onClick={()=>sa("mapEvent",opt)} className={cn("w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",isSel&&!a.answered&&"bg-amber-500/20 text-amber-300 border-amber-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-green-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div></div>);
}

function MapCitiesQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const mc=q.mapCities!;
  return (<div className="space-y-4"><div className="p-4 rounded-lg bg-[#0a0e18] border border-emerald-900/20"><p className="text-xs text-emerald-500 mb-2 flex items-center gap-1"><Landmark size={12} /> Историческая география</p><p className="text-gray-300 text-sm leading-relaxed">{mc.description}</p></div><div className="space-y-2"><p className="text-xs text-gray-400">Укажите название города:</p><div className="grid grid-cols-2 gap-2">{mc.options.map(opt=>{const isSel=a.userAnswer["mapCity"]===opt;const isCor=a.answered&&opt===mc.correctCity;const isWrg=a.answered&&isSel&&opt!==mc.correctCity;return(<motion.button key={opt} whileHover={{scale:1.03}} whileTap={{scale:0.97}} disabled={a.answered} onClick={()=>sa("mapCity",opt)} className={cn("px-3 py-2.5 rounded-lg text-sm font-medium border transition-all",isSel&&!a.answered&&"bg-amber-500/20 text-amber-300 border-amber-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-emerald-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div></div>);
}

function ArgumentationQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const aq=q.argumentation!;
  return (<div className="space-y-4"><div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20"><p className="text-xs text-purple-400 mb-1">Точка зрения:</p><p className="text-gray-300 text-sm font-medium italic">«{aq.viewpoint}»</p></div><div className="space-y-2"><p className="text-xs text-gray-400">Выберите один факт, подтверждающий эту точку зрения:</p><div className="grid gap-2">{aq.facts.map((fact,i)=>{const isSel=a.selectedFact===fact;const isCor=a.answered&&i===aq.correctFactIndex;const isWrg=a.answered&&isSel&&i!==aq.correctFactIndex;return(<motion.button key={i} whileHover={{scale:1.01}} whileTap={{scale:0.99}} disabled={a.answered} onClick={()=>sa("selectedFact",fact)} className={cn("w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",isSel&&!a.answered&&"bg-purple-500/20 text-purple-300 border-purple-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-purple-500/30 hover:text-gray-300")}><span className="text-gray-500 mr-2">{String.fromCharCode(65+i)}.</span>{fact}</motion.button>);})}</div></div><div><label className="text-xs text-gray-400 mb-1 block">Объясните, почему выбранный факт подтверждает точку зрения:</label><Textarea value={a.explanation||""} onChange={e=>sa("explanation",e.target.value)} disabled={a.answered} placeholder="Напишите объяснение..." rows={3} className="bg-[#0a0e18] border-amber-900/20 text-gray-300 text-sm resize-none"/></div></div>);
}

function ChronologyQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const cq=q.chronology!;
  const halves=["Первая половина XVI века","Вторая половина XVI века","Первая половина XVII века","Вторая половина XVII века"];
  return (<div className="space-y-4"><div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"><p className="text-xs text-rose-400 mb-1">Российское событие:</p><p className="text-gray-300 text-sm font-medium">{cq.russianEvent}</p></div><div><p className="text-xs text-gray-400 mb-2">Укажите половину века:</p><div className="grid grid-cols-2 gap-2">{halves.map(opt=>{const isSel=a.userAnswer["half"]===opt;const isCor=a.answered&&opt===cq.correctHalf;const isWrg=a.answered&&isSel&&opt!==cq.correctHalf;return(<motion.button key={opt} whileHover={{scale:1.03}} whileTap={{scale:0.97}} disabled={a.answered} onClick={()=>sa("half",opt)} className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-all",isSel&&!a.answered&&"bg-rose-500/20 text-rose-300 border-rose-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-rose-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div><div><p className="text-xs text-gray-400 mb-2">Укажите зарубежное событие из той же половины века:</p><div className="grid gap-2">{cq.foreignEventOptions.map((opt,i)=>{const isSel=a.foreignEvent===opt;const isCor=a.answered&&i===cq.correctForeignIndex;const isWrg=a.answered&&isSel&&i!==cq.correctForeignIndex;return(<motion.button key={i} whileHover={{scale:1.01}} whileTap={{scale:0.99}} disabled={a.answered} onClick={()=>sa("foreignEvent",opt)} className={cn("w-full text-left px-4 py-2 rounded-lg text-sm border transition-all",isSel&&!a.answered&&"bg-rose-500/20 text-rose-300 border-rose-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-rose-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div></div>);
}

function CultureCenturyQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const cq=q.cultureCentury!;
  const toggle = (m:string)=>{const cur=a.selectedMonuments||[];if(cur.includes(m))sa("selectedMonuments",JSON.stringify(cur.filter(x=>x!==m)));else if(cur.length<2)sa("selectedMonuments",JSON.stringify([...cur,m]));};
  return (<div className="space-y-4"><div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20"><p className="text-pink-300 text-sm font-medium">Выберите <strong>ДВА</strong> памятника культуры, относящихся к <strong>{cq.century}</strong>:</p></div><div className="grid gap-2">{cq.monuments.map((monument,i)=>{const sel=(a.selectedMonuments||[]).includes(monument);const isCor=a.answered&&cq.correctIndices.includes(i);const isWrg=a.answered&&sel&&!cq.correctIndices.includes(i);const isMissed=a.answered&&!sel&&cq.correctIndices.includes(i);return(<motion.button key={i} whileHover={{scale:1.01}} whileTap={{scale:0.99}} disabled={a.answered||(sel&&(a.selectedMonuments||[]).length>=2)} onClick={()=>toggle(monument)} className={cn("w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",sel&&!a.answered&&"bg-pink-500/20 text-pink-300 border-pink-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",isMissed&&"bg-amber-500/10 text-amber-400 border-amber-500/30 border-dashed",!sel&&!isCor&&!isWrg&&!isMissed&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-pink-500/30 hover:text-gray-300")}><span className="text-gray-500 mr-2">{i+1}.</span>{monument}{isCor&&<CheckCircle2 size={14} className="inline ml-2 text-emerald-400"/>}{isWrg&&<XCircle size={14} className="inline ml-2 text-rose-400"/>}</motion.button>);})}</div></div>);
}

function CultureCreatorQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const cq=q.cultureCreator!;
  return (<div className="space-y-4"><div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"><p className="text-xs text-orange-400 mb-1">Памятник культуры:</p><p className="text-gray-300 text-sm font-medium">{cq.monument}</p></div><div className="space-y-2"><p className="text-xs text-gray-400">Кто является автором/создателем?</p><div className="grid gap-2">{cq.creatorOptions.map((opt,i)=>{const isSel=a.selectedCreator===opt;const isCor=a.answered&&i===cq.correctCreatorIndex;const isWrg=a.answered&&isSel&&i!==cq.correctCreatorIndex;return(<motion.button key={i} whileHover={{scale:1.01}} whileTap={{scale:0.99}} disabled={a.answered} onClick={()=>sa("selectedCreator",opt)} className={cn("w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",isSel&&!a.answered&&"bg-orange-500/20 text-orange-300 border-orange-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-orange-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div></div>);
}

function VovQuestion({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  const vq=q.vov!;
  return (<div className="space-y-4"><div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"><p className="text-xs text-red-400 mb-1 flex items-center gap-1"><Shield size={12} /> Великая Отечественная война</p><p className="text-gray-300 text-sm font-medium">{vq.question}</p></div><div className="grid gap-2">{vq.options.map((opt,i)=>{const isSel=a.vovAnswer===opt;const isCor=a.answered&&i===vq.correctIndex;const isWrg=a.answered&&isSel&&i!==vq.correctIndex;return(<motion.button key={i} whileHover={{scale:1.01}} whileTap={{scale:0.99}} disabled={a.answered} onClick={()=>sa("vovAnswer",opt)} className={cn("w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all",isSel&&!a.answered&&"bg-red-500/20 text-red-300 border-red-500/40",isCor&&"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",isWrg&&"bg-rose-500/20 text-rose-300 border-rose-500/40",!isSel&&!isCor&&!isWrg&&"bg-[#0a0e18] text-gray-400 border-gray-700/50 hover:border-red-500/30 hover:text-gray-300")}>{opt}</motion.button>);})}</div></div>);
}

function QuestionRenderer({ question:q, answers:a, setAnswer:sa }: {question:Question;answers:AnswerState;setAnswer:(k:string,v:string)=>void}) {
  switch(q.type){
    case "matching": return <MatchingQuestion question={q} answers={a} setAnswer={sa}/>;
    case "source_who_when": return <SourceWhoWhenQuestion question={q} answers={a} setAnswer={sa}/>;
    case "source_details": return <SourceDetailsQuestion question={q} answers={a} setAnswer={sa}/>;
    case "map_event": return <MapEventQuestion question={q} answers={a} setAnswer={sa}/>;
    case "map_cities": return <MapCitiesQuestion question={q} answers={a} setAnswer={sa}/>;
    case "argumentation": return <ArgumentationQuestion question={q} answers={a} setAnswer={sa}/>;
    case "chronology": return <ChronologyQuestion question={q} answers={a} setAnswer={sa}/>;
    case "culture_century": return <CultureCenturyQuestion question={q} answers={a} setAnswer={sa}/>;
    case "culture_creator": return <CultureCreatorQuestion question={q} answers={a} setAnswer={sa}/>;
    case "vov": return <VovQuestion question={q} answers={a} setAnswer={sa}/>;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   RESULTS SUMMARY
   ═══════════════════════════════════════════════════════════════════ */

function ResultsSummary({ answerStates, questions, onRestart }: { answerStates: Map<number,AnswerState>; questions:Question[]; onRestart:()=>void }) {
  const totalCorrect = Array.from(answerStates.values()).filter(a=>a.correct).length;
  const total = questions.length;
  const pct = Math.round((totalCorrect/total)*100);
  const grade = pct>=90?{label:"Отлично! 🌟",color:"text-emerald-400",emoji:"🏆"}:pct>=75?{label:"Хорошо!",color:"text-amber-400",emoji:"⭐"}:pct>=50?{label:"Удовлетворительно",color:"text-yellow-400",emoji:"📚"}:{label:"Нужно подтянуть",color:"text-rose-400",emoji:"💪"};
  const wrong = questions.filter(q=>!answerStates.get(q.id)?.correct);
  const typeBreakdown = useMemo(()=>{const m=new Map<QuestionType,{correct:number;total:number}>();questions.forEach(q=>{const c=m.get(q.type)||{correct:0,total:0};c.total++;if(answerStates.get(q.id)?.correct)c.correct++;m.set(q.type,c);});return Array.from(m.entries());},[answerStates,questions]);

  return (<motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} className="max-w-2xl mx-auto space-y-6">
    <Card className="bg-[#111827] border-amber-900/20 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/5 to-amber-500/20 p-6 text-center">
        <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",bounce:0.5}} className="text-6xl mb-3">{grade.emoji}</motion.div>
        <h2 className={cn("text-2xl font-bold",grade.color)}>{grade.label}</h2>
        <p className="text-gray-400 text-sm mt-1">Правильных ответов: {totalCorrect} из {total}</p>
        <div className="mt-4 max-w-xs mx-auto"><Progress value={pct} className="h-3 bg-[#0a0e18]"/></div>
        <p className="text-amber-400 text-3xl font-bold mt-2">{pct}%</p>
      </div>
    </Card>
    <Card className="bg-[#111827] border-amber-900/20"><CardHeader className="pb-3"><CardTitle className="text-amber-400 text-sm flex items-center gap-2"><BarChart3Icon size={16}/>Результаты по типам</CardTitle></CardHeader><CardContent className="space-y-2">{typeBreakdown.map(([type,data])=>{const meta=TYPE_META[type];const p=data.total>0?Math.round((data.correct/data.total)*100):0;return(<div key={type} className="flex items-center gap-3"><Badge variant="outline" className={cn("shrink-0",meta.color)}>{meta.icon}<span className="text-[10px] ml-1">{meta.label}</span></Badge><div className="flex-1"><div className="h-2 bg-[#0a0e18] rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${p}%`}} transition={{duration:0.8,delay:0.2}} className={cn("h-full rounded-full",p>=75?"bg-emerald-500":p>=50?"bg-amber-500":"bg-rose-500")}/></div></div><span className="text-xs text-gray-400 shrink-0 w-16 text-right">{data.correct}/{data.total} ({p}%)</span></div>);})}</CardContent></Card>
    {wrong.length>0&&<Card className="bg-[#111827] border-amber-900/20"><CardHeader className="pb-3"><CardTitle className="text-rose-400 text-sm flex items-center gap-2"><XCircle size={16}/>Ошибки — повторите материал</CardTitle></CardHeader><CardContent className="space-y-3">{wrong.map(q=>(<div key={q.id} className="p-3 rounded-lg bg-[#0a0e18] border border-rose-900/20"><div className="flex items-center gap-2 mb-1"><span className="text-rose-400 text-xs font-bold">#{q.id}</span><QuestionTypeBadge type={q.type}/></div><p className="text-gray-400 text-xs mt-1">{q.explanation}</p></div>))}</CardContent></Card>}
    <div className="flex gap-3 justify-center"><Button onClick={onRestart} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"><RotateCcw size={16}/>Пройти заново</Button></div>
  </motion.div>);
}

/* ═══════════════════════════════════════════════════════════════════
   REFERENCE (SPRAVOCHNIK) SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function BadgeLine({ children }: { children: React.ReactNode }) {
  return <Badge variant="outline" className="rounded-full border-amber-500/25 bg-amber-500/10 text-amber-300 px-3 py-1">{children}</Badge>;
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (<div className="flex flex-col gap-1"><div className="flex items-center gap-2"><span className="text-amber-400">{icon}</span><h2 className="text-xl sm:text-2xl font-bold text-amber-100">{title}</h2></div>{subtitle?<p className="text-sm text-gray-400 max-w-3xl">{subtitle}</p>:null}</div>);
}

function RulerCard({ ruler, active, onClick }: { ruler: Ruler; active: boolean; onClick:()=>void }) {
  return (<motion.button type="button" onClick={onClick} whileHover={{y:-3}} whileTap={{scale:0.98}} className={cn("text-left w-full rounded-2xl border p-4 transition shadow-sm",active?"border-amber-400/40 bg-amber-500/10 shadow-amber-500/10":"border-amber-900/20 bg-[#0b1020] hover:border-amber-700/30")}>
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-amber-200">{ruler.name}</h3><Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">{ruler.years}</Badge></div><p className="mt-2 text-sm text-gray-300 leading-relaxed">{ruler.headline}</p></div><ChevronDown className={cn("mt-1 h-4 w-4 text-amber-400 transition",active&&"rotate-180")}/></div>
    <AnimatePresence initial={false}>{active&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="mt-4 space-y-3"><div className="flex flex-wrap gap-2">{ruler.keyEvents.map(item=><BadgeLine key={item}>{item}</BadgeLine>)}</div><Separator className="bg-amber-900/15"/><div className="grid gap-2 text-sm"><div><span className="text-gray-500">Что запомнить:</span>{" "}<span className="text-gray-200">{ruler.halfCentury}</span></div><div><span className="text-gray-500">Экзаменные связки:</span><div className="mt-1 flex flex-wrap gap-2">{ruler.examPairs.map(pair=><Badge key={pair} variant="secondary" className="bg-slate-800 text-slate-200 border border-slate-700">{pair}</Badge>)}</div></div><div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-200"><span className="font-semibold">Ловушка:</span> {ruler.trap}</div></div></div></motion.div>}</AnimatePresence>
  </motion.button>);
}

function ToggleReveal({ title, body, answer }: { title: string; body: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (<Card className="border-amber-900/20 bg-[#0b1020]"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-amber-400">{title}</p><p className="mt-1 text-sm text-gray-300">{body}</p></div><Button variant="ghost" size="sm" onClick={()=>setOpen(v=>!v)} className="text-amber-300 hover:text-amber-200 shrink-0">{open?"Скрыть":"Показать"}</Button></div><AnimatePresence>{open&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100"><span className="font-semibold">Ответ:</span> {answer}</div></motion.div>}</AnimatePresence></CardContent></Card>);
}

function TimelineRow({ item, active, onClick, rulerName }: { item: TimelineEvent; active: boolean; onClick:()=>void; rulerName: string }) {
  return (<motion.button type="button" onClick={onClick} whileHover={{scale:1.01}} className={cn("w-full text-left rounded-2xl border p-4 transition",active?"border-emerald-400/40 bg-emerald-500/10":"border-amber-900/20 bg-[#0b1020] hover:border-amber-700/30")}>
    <div className="flex items-start gap-3"><div className={cn("mt-1 h-3 w-3 rounded-full shrink-0",active?"bg-emerald-400":"bg-amber-400")}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-amber-500/30 text-amber-300">{item.year}</Badge><span className="font-semibold text-amber-100">{item.event}</span><Badge variant="secondary" className="bg-slate-800 text-slate-200 border border-slate-700">{rulerName}</Badge></div><p className="mt-2 text-sm text-gray-300">{item.whyItMatters}</p></div><ChevronDown className={cn("mt-1 h-4 w-4 text-amber-400 transition",active&&"rotate-180")}/></div>
  </motion.button>);
}

/* ═══════════════════════════════════════════════════════════════════
   CONFETTI EFFECT
   ═══════════════════════════════════════════════════════════════════ */

function ConfettiPiece({ delay }: { delay: number }) {
  const colors = ["#f59e0b","#10b981","#3b82f6","#ec4899","#8b5cf6","#f97316"];
  const color = colors[Math.floor(Math.random()*colors.length)];
  const left = Math.random()*100;
  return (
    <motion.div initial={{y:-20,opacity:1,x:0,rotate:0}} animate={{y:400,opacity:0,x:(Math.random()-0.5)*100,rotate:Math.random()*720}} transition={{duration:1.5,delay,ease:"easeOut"}} className="absolute w-2 h-2 rounded-sm" style={{top:-10,left:`${left}%`,backgroundColor:color}}/>
  );
}

function ConfettiBurst() {
  return (<div className="absolute inset-0 overflow-hidden pointer-events-none z-50">{Array.from({length:30}).map((_,i)=><ConfettiPiece key={i} delay={i*0.03}/>)}</div>);
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function HistoryCheatsheetPage() {
  const [activeTab, setActiveTab] = useState<string>("quiz");

  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<number,AnswerState>>(new Map());
  const [showConfetti, setShowConfetti] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const currentQuestion = QUESTIONS[currentIdx];
  const currentAnswer = answers.get(currentQuestion?.id) || { answered:false, correct:false, userAnswer:{} };
  const progress = answers.size / QUESTIONS.length;

  const setAnswer = useCallback((key:string, value:string)=>{
    setAnswers(prev=>{
      const cur = prev.get(currentQuestion.id) || {answered:false,correct:false,userAnswer:{}};
      const updated = { ...cur, userAnswer:{...cur.userAnswer,[key]:value},
        ...(key==="selectedFact"?{selectedFact:value}:{}),
        ...(key==="foreignEvent"?{foreignEvent:value}:{}),
        ...(key==="selectedMonuments"?{selectedMonuments:JSON.parse(value)}:{}),
        ...(key==="selectedCreator"?{selectedCreator:value}:{}),
        ...(key==="vovAnswer"?{vovAnswer:value}:{}),
        ...(key==="explanation"?{explanation:value}:{}),
      };
      return new Map(prev).set(currentQuestion.id, updated);
    });
  },[currentQuestion]);

  const handleSubmit = useCallback(()=>{
    const ans = answers.get(currentQuestion.id) || {answered:false,correct:false,userAnswer:{}};
    if(ans.answered) return;
    const isCorrect = checkAnswer(currentQuestion, ans);
    const newState = { ...ans, answered:true, correct:isCorrect };
    setAnswers(prev => new Map(prev).set(currentQuestion.id, newState));
    if(isCorrect) { setShowConfetti(true); setTimeout(()=>setShowConfetti(false),1500); }
    else { setShakeKey(k=>k+1); }
  },[currentQuestion, answers]);

  useEffect(()=>{
    if(answers.size === QUESTIONS.length) {
      const timer = setTimeout(()=>setActiveTab("results"),800);
      return ()=>clearTimeout(timer);
    }
  },[answers.size]);

  const handleNext = useCallback(()=>{
    if(currentIdx < QUESTIONS.length-1) setCurrentIdx(i=>i+1);
  },[currentIdx]);

  const handleRestart = useCallback(()=>{
    setAnswers(new Map()); setCurrentIdx(0); setQuizStarted(false); setShowConfetti(false); setActiveTab("quiz");
  },[]);

  // Reference state
  const [selectedRulerId, setSelectedRulerId] = useState<string>("ivan4");
  const [activeDrillType, setActiveDrillType] = useState<string>("Тип 1 — соответствие");
  const currentDrills = useMemo(()=>DRILLS.filter(d=>d.type===activeDrillType),[activeDrillType]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Sticky Tab Bar */}
      <div className="sticky top-0 z-40 bg-[#0a0a1a]/95 backdrop-blur-md border-b border-amber-900/20">
        <div className="mx-auto max-w-7xl px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent h-auto p-1 gap-1 w-full max-w-md mx-auto">
              <TabsTrigger value="quiz" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400 rounded-lg px-4 py-2.5 text-sm font-medium gap-2">
                <Target size={16}/> Тренировка
              </TabsTrigger>
              <TabsTrigger value="spravochnik" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400 rounded-lg px-4 py-2.5 text-sm font-medium gap-2">
                <BookOpen size={16}/> Справочник
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ════════ QUIZ TAB ════════ */}
          {activeTab==="quiz"&&(
            <motion.div key="quiz" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}} transition={{duration:0.3}}>
              {!quizStarted ? (
                /* Start Screen */
                <motion.div initial={{opacity:0}} animate={{opacity:1}} className="max-w-3xl mx-auto space-y-6">
                  <div className="text-center space-y-4 py-8">
                    <motion.div initial={{scale:0,rotate:-180}} animate={{scale:1,rotate:0}} transition={{type:"spring",bounce:0.4}} className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-4"><History size={40} className="text-amber-400"/></motion.div>
                    <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">ИСТОРИЯ EXPLORER</h1>
                    <p className="text-gray-400 text-lg max-w-lg mx-auto">Интерактивный тренажёр подготовки к ВПР по истории России. 7 класс: XIV–XX века.</p>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Target size={14}/> 24 вопроса</span>
                      <span className="flex items-center gap-1"><Users size={14}/> 10 типов</span>
                      <span className="flex items-center gap-1"><Clock size={14}/> Без ограничений</span>
                    </div>
                  </div>
                  <Card className="bg-[#111827] border-amber-900/20"><CardHeader className="pb-3"><CardTitle className="text-amber-400 text-sm">Типы заданий ВПР</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{(Object.entries(TYPE_META) as [QuestionType, typeof TYPE_META[QuestionType]][]).map(([type,meta])=>{const count=QUESTIONS.filter(q=>q.type===type).length;return(<div key={type} className="flex items-center gap-2 p-2 rounded-lg bg-[#0a0e18] border border-amber-900/10"><Badge variant="outline" className={cn("shrink-0",meta.color)}>{meta.icon}</Badge><span className="text-gray-300 text-xs flex-1">{meta.label}</span><Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400">{count}</Badge></div>);})}</div></CardContent></Card>
                  <div className="text-center pb-8"><motion.div whileHover={{scale:1.05}} whileTap={{scale:0.95}}><Button onClick={()=>setQuizStarted(true)} size="lg" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold text-lg px-10 py-6 shadow-lg shadow-amber-500/25 gap-2"><Zap size={20}/>Начать тренировку<ArrowRight size={20}/></Button></motion.div><p className="text-gray-500 text-xs mt-3">Вы сможете переключиться на справочник в любой момент</p></div>
                </motion.div>
              ) : (
                /* Quiz Active */
                <div className="max-w-3xl mx-auto space-y-4">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Вопрос {currentIdx+1} из {QUESTIONS.length}</span><span className="text-amber-400 font-medium">{Math.round(progress*100)}%</span></div>
                    <Progress value={progress*100} className="h-2 bg-slate-800"/>
                  </div>
                  {/* Navigation dots */}
                  <div className="flex gap-1.5 flex-wrap justify-center">{QUESTIONS.map((q,i)=>{
                    const ans = answers.get(q.id);
                    const isActive = i===currentIdx;
                    return <button key={q.id} onClick={()=>setCurrentIdx(i)} className={cn("w-3 h-3 rounded-full transition-all",ans?.correct?"bg-emerald-500":ans?.answered?"bg-rose-500":isActive?"bg-amber-400 ring-2 ring-amber-400/30":"bg-slate-700 hover:bg-slate-600")}/>;
                  })}</div>
                  {/* Question Card */}
                  <motion.div key={shakeKey} animate={shakeKey>0?{x:[0,-8,8,-6,6,-3,3,0]}:{}} transition={{duration:0.5}} className="relative">
                    {showConfetti&&<ConfettiBurst/>}
                    <Card className="bg-[#111827] border-amber-900/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between"><QuestionTypeBadge type={currentQuestion.type}/>{currentAnswer.answered&&<FeedbackBadge correct={currentAnswer.correct}/>}</div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <QuestionRenderer question={currentQuestion} answers={currentAnswer} setAnswer={setAnswer}/>
                        {!currentAnswer.answered&&<div className="flex items-center gap-3 pt-2"><HintCard hint={currentQuestion.hint}/><Button onClick={handleSubmit} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2 ml-auto"><CheckCircle2 size={16}/>Ответить</Button></div>}
                        {currentAnswer.answered&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-3"><Separator className="bg-amber-900/20"/><div className="p-3 rounded-lg bg-[#0a0e18] border border-amber-900/20"><p className="text-xs text-amber-400 mb-1">Пояснение:</p><p className="text-sm text-gray-300">{currentQuestion.explanation}</p></div><div className="flex justify-end">{currentIdx<QUESTIONS.length-1?<Button onClick={handleNext} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 gap-2">Далее<ChevronRight size={16}/></Button>:<span className="text-sm text-gray-500">Все вопросы завершены!</span>}</div></motion.div>}
                      </CardContent>
                    </Card>
                  </motion.div>
                  {/* Nav buttons */}
                  <div className="flex justify-between"><Button variant="ghost" onClick={()=>setCurrentIdx(i=>Math.max(0,i-1))} disabled={currentIdx===0} className="text-gray-400 gap-1"><ChevronLeft size={16}/>Назад</Button><Button variant="ghost" onClick={()=>setCurrentIdx(i=>Math.min(QUESTIONS.length-1,i+1))} disabled={currentIdx===QUESTIONS.length-1} className="text-gray-400 gap-1">Далее<ChevronRight size={16}/></Button></div>
                </div>
              )}
            </motion.div>
          )}

          {/* ════════ RESULTS TAB ════════ */}
          {activeTab==="results"&&(
            <motion.div key="results" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}} transition={{duration:0.3}}>
              {answers.size>0 ? <ResultsSummary answerStates={answers} questions={QUESTIONS} onRestart={handleRestart}/> : <div className="text-center py-20 text-gray-500"><p>Пройдите тест, чтобы увидеть результаты</p><Button onClick={()=>setActiveTab("quiz")} className="mt-4 bg-amber-500 hover:bg-amber-600 text-black">Начать тренировку</Button></div>}
            </motion.div>
          )}

          {/* ════════ SPRAVOCHNIK TAB ════════ */}
          {activeTab==="spravochnik"&&(
            <motion.div key="spravochnik" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}} transition={{duration:0.3}}>
              {/* Hero */}
              <div className="mb-6 rounded-3xl border border-amber-900/20 bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#0a0a1a] p-5 sm:p-8 shadow-2xl">
                <div className="flex flex-wrap items-center gap-2 mb-4"><BadgeLine>ВПР — история, 7 класс</BadgeLine><BadgeLine>Россия XIV–XVII вв.</BadgeLine></div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-500 bg-clip-text text-transparent">Справочник</h1>
                <p className="mt-3 max-w-3xl text-sm sm:text-base text-gray-300 leading-relaxed">Связки «правитель → событие → век → ловушка экзамена» для быстрой ориентации в заданиях ВПР.</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  {/* 1. Ruler Cards */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Crown size={18}/>} title="Карта правителей" subtitle="Нажимай на карточку — держи в голове главное: кто, когда и какой экзаменный крючок."/></CardHeader><CardContent className="space-y-3">{RULERS.map(r=>(<RulerCard key={r.id} ruler={r} active={r.id===selectedRulerId} onClick={()=>setSelectedRulerId(r.id)}/>))}</CardContent></Card>

                  {/* 2. Source Practice (Drills) */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Target size={18}/>} title="Тренировка по типам заданий" subtitle="Короткие экзаменные связки для быстрого повторения."/></CardHeader><CardContent>
                    <Tabs value={activeDrillType} onValueChange={setActiveDrillType}>
                      <ScrollArea className="w-full pb-2"><TabsList className="mb-4 inline-flex h-auto flex-wrap gap-2 bg-transparent p-0">{Array.from(new Set(DRILLS.map(d=>d.type))).map(type=>(<TabsTrigger key={type} value={type} className="rounded-full border border-amber-900/20 bg-[#0b1020] px-3 py-1.5 text-xs text-gray-300 data-[state=active]:border-amber-400/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-200">{type}</TabsTrigger>))}</TabsList></ScrollArea>
                      <div className="space-y-3">{currentDrills.map(drill=>(<Card key={drill.id} className="border-amber-900/20 bg-[#0b1020]"><CardContent className="p-4"><BadgeLine>{drill.type}</BadgeLine><p className="mt-3 text-sm text-gray-300">{drill.question}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"><div className="text-xs uppercase tracking-wide text-emerald-300">Ответ</div><div className="mt-1 font-semibold text-emerald-100">{drill.answer}</div></div><div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3"><div className="text-xs uppercase tracking-wide text-sky-300">Почему</div><div className="mt-1 text-sm text-sky-100">{drill.why}</div></div></div></CardContent></Card>))}</div>
                    </Tabs>
                  </CardContent></Card>

                  {/* 3. Culture by Century */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Palette size={18}/>} title="Культура по векам" subtitle="Быстро отсекай лишнее по веку."/></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{CULTURE.map(block=>(<div key={block.century} className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><BadgeLine>{block.century}</BadgeLine><ul className="mt-3 space-y-2">{block.items.map(item=>(<li key={item} className="flex items-start gap-2 text-sm text-gray-300"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"/><span>{item}</span></li>))}</ul></div>))}</CardContent></Card>

                  {/* 4. Foreign Parallels */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Globe size={18}/>} title="Зарубежные параллели" subtitle="Для задания на половину века — зарубежное событие из той же половины."/></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{FOREIGN.map(block=>(<div key={block.period} className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><BadgeLine>{block.period}</BadgeLine><ul className="mt-3 space-y-2">{block.events.map(item=>(<li key={item} className="flex items-start gap-2 text-sm text-gray-300"><Globe className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400"/><span>{item}</span></li>))}</ul></div>))}</CardContent></Card>
                </div>

                <div className="space-y-6">
                  {/* 5. Timeline with Ruler Names */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-amber-400 text-base"><Clock size={18}/>Лента времени с правителем</CardTitle></CardHeader><CardContent className="space-y-3">
                    <div className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex flex-wrap items-center gap-2"><BadgeLine>{RULERS.find(r=>r.id===selectedRulerId)?.name}</BadgeLine><BadgeLine>{RULERS.find(r=>r.id===selectedRulerId)?.years}</BadgeLine></div><p className="mt-2 text-sm text-gray-300">{RULERS.find(r=>r.id===selectedRulerId)?.headline}</p></div>
                    <ScrollArea className="max-h-[60vh]"><div className="space-y-3 pb-4">{TIMELINE.map(item=>{const ruler=RULERS.find(r=>r.id===item.rulerId);return(<TimelineRow key={`${item.year}-${item.event}`} item={item} active={item.rulerId===selectedRulerId} onClick={()=>setSelectedRulerId(item.rulerId)} rulerName={ruler ? ruler.name : "—"}/>);})}</div></ScrollArea>
                  </CardContent></Card>

                  {/* 6. Exam Traps */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Brain size={18}/>} title="Экзаменные ловушки" subtitle="Типичные ошибки — закрепи в памяти сразу."/></CardHeader><CardContent className="space-y-3">{EXAM_TRAPS.map(trap=>(<div key={trap.title} className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-amber-400"/><h3 className="font-semibold text-amber-100">{trap.title}</h3></div><p className="mt-2 text-sm text-gray-300">{trap.text}</p></div>))}</CardContent></Card>

                  {/* 7. Source Practice */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Scroll size={18}/>} title="Источник: практика" subtitle="Типы 2 и 3 — выхватываешь ключевые данные из текста."/></CardHeader><CardContent className="space-y-3">
                    <ToggleReveal title="Источник 1" body="«...вёл тяжёлую войну против Сигизмунда... захватил Смоленск...»" answer="Василий III, 1514 год, Смоленск."/>
                    <ToggleReveal title="Источник 2" body="«...избрали Михаила Романова на царство...»" answer="1613 год, первая половина XVII века, конец Смутного времени."/>
                    <ToggleReveal title="Источник 3" body="«...в битве под Смоленском погибло более тридцати тысяч...»" answer="События русско-польской войны начала XVI века."/>
                  </CardContent></Card>

                  {/* 8. Association Mnemonics */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Swords size={18}/>} title="Ассоциации для запоминания" subtitle="Мини-код для типичных событий."/></CardHeader><CardContent className="space-y-3">
                    <div className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex items-center gap-2"><BadgeLine>Молоди</BadgeLine><BadgeLine>Воротынский</BadgeLine></div><p className="mt-2 text-sm text-gray-300">Сильный ответ для типа 1 и аргументации про успешную внешнюю политику Ивана IV.</p></div>
                    <div className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex items-center gap-2"><BadgeLine>урочные лета</BadgeLine><BadgeLine>1597</BadgeLine><BadgeLine>Фёдор Иоаннович</BadgeLine></div><p className="mt-2 text-sm text-gray-300">Запомни связку целиком — в заданиях часто меняют только одно слово.</p></div>
                    <div className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex items-center gap-2"><BadgeLine>Михаил Романов</BadgeLine><BadgeLine>1613</BadgeLine></div><p className="mt-2 text-sm text-gray-300">Точка, где Смута заканчивается и стартует новая династия.</p></div>
                  </CardContent></Card>

                  {/* 9. Treaties */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Landmark size={18}/>} title="Мирные договоры" subtitle="Быстро отсеивай ответ по внешней политике."/></CardHeader><CardContent className="space-y-3">{TREATIES.map(t=>(<div key={t.year} className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex flex-wrap items-center gap-2"><BadgeLine>{t.year}</BadgeLine><BadgeLine>{t.name}</BadgeLine><Badge variant="secondary" className="bg-slate-800 text-slate-200 border border-slate-700">{t.opponent}</Badge></div><p className="mt-2 text-sm text-gray-300">{t.result}</p></div>))}</CardContent></Card>

                  {/* 10. Key Answer Chains */}
                  <Card className="border-amber-900/20 bg-[#111827]"><CardHeader className="pb-3"><SectionTitle icon={<Award size={18}/>} title="Главные связки на ВПР" subtitle="Прогоняй глазами перед тестом — буквально за минуту."/></CardHeader><CardContent className="space-y-3"><div className="grid gap-3">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="text-xs uppercase tracking-wide text-emerald-300">Связка №1</div><div className="mt-1 font-semibold text-emerald-50">1514 → Смоленск → Василий III</div></div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="text-xs uppercase tracking-wide text-emerald-300">Связка №2</div><div className="mt-1 font-semibold text-emerald-50">1572 → Молоди → Воротынский</div></div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="text-xs uppercase tracking-wide text-emerald-300">Связка №3</div><div className="mt-1 font-semibold text-emerald-50">1597 → урочные лета → Фёдор Иоаннович</div></div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="text-xs uppercase tracking-wide text-emerald-300">Связка №4</div><div className="mt-1 font-semibold text-emerald-50">1613 → Михаил Романов → конец Смуты</div></div>
                  </div></CardContent></Card>
                </div>
              </div>

              {/* 11. Answer Scheme */}
              <div className="mt-6 rounded-3xl border border-amber-900/20 bg-[#111827] p-5 sm:p-6">
                <SectionTitle icon={<Sparkles size={18}/>} title="Схема ответа на любой вопрос" subtitle="Сначала поймай эпоху, потом правителя, потом событие."/>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    {title:"1. Узнай век",text:"1480 — конец XV. 1514/1552/1572 — XVI. 1613/1649/1671 — XVII."},
                    {title:"2. Найди правителя",text:"Иван III — Угра. Василий III — Смоленск. Иван IV — Казань и Молоди. Михаил Романов — 1613."},
                    {title:"3. Сопоставь событие",text:"Выбери вариант, который соответствует найденному правителю и веку."},
                  ].map(step=>(<div key={step.title} className="rounded-2xl border border-amber-900/20 bg-[#0b1020] p-4"><div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">{step.title[0]}</div><h3 className="font-semibold text-amber-100 text-sm">{step.title}</h3></div><p className="text-sm text-gray-400">{step.text}</p></div>))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
