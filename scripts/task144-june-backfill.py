#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task144: june rentals backfill from boss voice note «26 окт., 18.45 june full.mp3» (1068s, ASR
43 coarse 25s chunks + 101 fine 10s chunks). Boss instructions (transcribed):
  «список сначала распарсить: дата, цена, имя — сравнить с тем что уже есть и добавляй
   недостающий»; «там где экип не сказано — типа не было»; «Хорвин [ЕКА-1] — несуществующий
   мот, но в базе может быть есть»; «сохрани все файлы; можем за несколько раз всё сделать».

Dedupe base (DB, crew vip-bike, june): 9 rows — Голубев 1.06 Z (null cost), Шаронов 5.06
EX650 10000, nibbler 17.06/20.06/21.06 bot-era, suzuki x3 20.06, Ларин 29.06 aprilia 6500.
Dedupe hits in dictation: Голубев (→ UPDATE price/times), Шаронов (skip), Ларин (skip, flag).

Pipeline: walk-in payload (user_id=owner_id=356282674, completed/fully_paid), operator
attribution created_by_operator_chat_id=7813830016 (djorudjov — boss: "operator is djorudjov"),
full provenance in metadata.specs.retro_backfill_audio_v3. Idempotent per-row.

Usage: python3 task144-june-backfill.py [--apply]
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key")).read().strip()
CREW_VIP_BIKE = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
WALKIN_USER = "356282674"          # Paul = salavey13 = crew owner (walk-in pattern)
OPERATOR_DJORUDJOV = "7813830016"  # boss: «operator is djorudjov» — crew admin, active
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")

APPLY = "--apply" in sys.argv
ORIGIN = ("голозаметка 26.10.2026 (26 окт. 18.45 june full.mp3, 1068с — ASR 43 грубых + 101 "
          "мелких чанка) — полная диктовка июньских аренд; босс: «сравни с тем что есть и "
          "добавляй недостающие; где экип не сказан — не было»")

BLACK_Z = "ducati-panigale-s-electro-black"

RENTALS = [
    {
        "_tag": "june-schmidt-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Шмит Руслан Дмитриевич",
        "start": "2026-06-03T10:00:00+00:00",
        "end": "2026-06-03T13:00:00+00:00",
        "total_cost": 2500,
        "duration_note": "«с десяти утра до часу» = 10:00→13:00 (3 часа)",
        "confidence": "medium",
        "note": ("[00:30] «Шмит Руслан Дмитриевич брал секвензера с десяти утра до часу. Цена две "
                 "пятьсот». Хвост «а по-другому не 2500 за час, типа 8 000 рублей» — неоднозначен "
                 "(возможно про суточную цену); в итог взята прозвучавшая цена 2 500 за 3 часа."),
    },
    {
        "_tag": "june-agapov-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Агапов Сергей Николаевич",
        "start": "2026-06-03T11:00:00+00:00",
        "end": "2026-06-03T13:00:00+00:00",
        "total_cost": 5000,
        "duration_note": "«с одиннадцати до часу» = 11:00→13:00 (2 часа)",
        "confidence": "high",
        "note": ("[00:50-01:15] «Агапов Сергей Николаевич брал дукути тоже в Нижалях с электора с "
                 "одиннадцати до часу» + [01:15] «5000 rubles». «Дукати Панигале С-электро», «тоже» = "
                 "как предыдущий (Голубев Z) → Black Z. В БД на 3.06 ничего нет."),
    },
    {
        "_tag": "june-melnikov-nibbler",
        "vehicle_id": "nibbler-regumoto-4v",
        "renter_name": "Мельников Алексей Борисович",
        "start": "2026-06-06T10:30:00+00:00",
        "end": "2026-06-06T13:30:00+00:00",
        "total_cost": 8000,
        "duration_note": "«10:30 до часу 30» = 10:30→13:30 (3 часа); рядом «четыре с половиной на три часа» — не расшифровано",
        "confidence": "medium",
        "note": ("[02:05-02:35] «Мельников Алексей Борисович… брал Ниблер… 10:30 до часу 30» + цена "
                 "«восемь тысяч» (дважды). Телефон продиктован, но ASR-прочтения расходятся "
                 "(«8-920-205-92-78» / «8-920-059-19-78») — НЕ вставлен, у босса спросить."),
    },
    {
        "_tag": "june-shimina-horwin",
        "vehicle_id": "horwin-cr1",
        "renter_name": "Шимина Вера Александровна",
        "start": "2026-06-06T12:30:00+00:00",
        "end": "2026-06-06T15:30:00+00:00",
        "total_cost": 6000,
        "duration_note": "«с двенадцать тридцать до пятнадцать тридцать» = 12:30→15:30 (3 часа)",
        "confidence": "medium",
        "note": ("[02:55-03:20] «Шимина Вера Александровна брала Хорвин ЕКА-1 с 12:30 до 15:30» + "
                 "[03:20] «Цена шесть тысяч». ЕКА-1 в парке НЕТ — босс: «несуществующий мот Хорвин, "
                 "в базе может быть есть» → замаплен на horwin-cr1 (единственный Хорвин в БД, "
                 "зелёный, svc-001 20.04). Если ЕКА-1 отдельный байк — одна правка vehicle_id. "
                 "Фамилия: ASR «Шимина» в обоих чтениях; телефон нечитаем — не вставлен."),
    },
    {
        "_tag": "june-novoselov-nibbler",
        "vehicle_id": "nibbler-regumoto-4v",
        "renter_name": "Новоселов Глеб Игоревич",
        "start": "2026-06-06T18:00:00+00:00",
        "end": "2026-06-07T18:00:00+00:00",
        "total_cost": 7500,
        "duration_note": "«с восемнадцати до восемнадцатого [следующего дня]» = сутки 18:00→18:00",
        "confidence": "medium",
        "note": ("[03:45] «Новоселов Глеб [Иванович/Игоревич] брал ниблер с восемнадцати до "
                 "восемнадцатого числа. Цена семь пятьсот». Отчество: coarse «Игоревич», fine "
                 "«Иванович» — взято coarse. В БД на 6.06 ниббера нет (Мельников — другой день/клиент)."),
    },
    {
        "_tag": "june-narinkov-breakout",
        "vehicle_id": "motoland-breakout",
        "renter_name": "Наринков Антон Николаевич",
        "start": "2026-06-06T18:00:00+00:00",
        "end": "2026-06-07T18:00:00+00:00",
        "total_cost": 6000,
        "duration_note": "«с восемнадцати до седьмого июня восемнадцать» = сутки 18:00→18:00",
        "confidence": "high",
        "note": ("[03:25] «Наринков Антони Николаевич, шестого июня с восемнадцати до седьмого июня "
                 "восемнадцать брал мото онлайн брейк аут. Цена шесть тысяч рублей» — чистое чтение. "
                 "«мото онлайн брейк аут» = Motoland Breakout 300."),
    },
    {
        "_tag": "june-konkov-kawasaki",
        "vehicle_id": "kawasaki-ex650k",
        "renter_name": "Конков Александр Сергеевич",
        "start": "2026-06-06T11:00:00+00:00",
        "end": "2026-06-07T20:00:00+00:00",
        "total_cost": 15000,
        "duration_note": "«шестого июня одиннадцать по седьмого июня восемь вечера» = 6.06 11:00→7.06 20:00 (33 ч)",
        "confidence": "low",
        "note": ("[04:00-04:15] «Конков Александр Сергеевич Кавасаки… брал шестого июня одиннадцать "
                 "по седьмого июня восемь вечера. Цена 150 [рублей]». Имя: coarse «Камков Алексей», "
                 "fine «Конков Александр» — конфликт, взято fine. Цена: «150» → вероятно 15 000 за "
                 "33 часа (~суторка EX650 10 000 + перерасход). ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ. Хвост «а это "
                 "не то же самое» — возможно, другой Кавасаки (не EX650)."),
    },
    {
        "_tag": "june-durandin-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Дурандин Сергей Владимирович",
        "start": "2026-06-07T09:00:00+00:00",
        "end": "2026-06-07T19:00:00+00:00",
        "total_cost": 12000,
        "duration_note": "время не продиктовано (стандартный день 09:00→19:00)",
        "confidence": "medium",
        "note": ("[04:20-04:30] «Дурандин [Дуриндин?] Сергей Владимирович Панигале С-электро» + "
                 "[04:35 coarse] «Седьмого числа, двенадцать тысяч рублей». Фамилия спорна "
                 "(«дурань/Дурандин/Дуриндин»)."),
    },
    {
        "_tag": "june-andronikov-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Андроников Алексей Сергеевич",
        "start": "2026-06-07T17:00:00+00:00",
        "end": "2026-06-07T19:00:00+00:00",
        "total_cost": 6500,
        "duration_note": "«с пяти до восьми минут на два часа» = 17:00→19:00 (2 часа)",
        "confidence": "high",
        "note": ("[04:45] «Седьмого июня Андроников Алексей Сергеевич секундзер брал с пяти до восьми "
                 "минут на два часа шесть пятьсот» — чистое чтение."),
    },
    {
        "_tag": "june-bagirov-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Багиров Рауф Эльчин оглы",
        "start": "2026-06-08T20:00:00+00:00",
        "end": "2026-06-09T11:00:00+00:00",
        "total_cost": 6000,
        "duration_note": "«с восьмого июня восемь вечера до девятого одиннадцать» = 20:00→11:00 (15 ч)",
        "confidence": "medium",
        "note": ("[05:05-05:35] «Багиров Рауф Ельчин оглы брал дукати понигалезет…» + fine «8:00 PM "
                 "to 9:15 AM» + «6000 rubles» (дважды). 6 000 за 15 ч Панигале — дёшево, но "
                 "прозвучало явно."),
    },
    {
        "_tag": "june-shmakov-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Шмаков Кирилл Александрович",
        "start": "2026-06-09T17:00:00+00:00",
        "end": "2026-06-09T18:00:00+00:00",
        "total_cost": 7500,
        "duration_note": "«с пятых до шести» = 17:00→18:00 (1 час)",
        "confidence": "medium",
        "note": ("[05:45-06:05] «Шмаков Кирилл Александрович, дукати понигале с-электро, с 17 до 18». "
                 "Цена: coarse «Семь [тысяч] пятьсот…», fine «шесть пятьсот и пятьдесят» — конфликт "
                 "6500/7500, взято 7 500. Дата: coarse «9th of June», fine «5 июня» — взято 9-е "
                 "(контекст диктовки 8-10 июня)."),
    },
    {
        "_tag": "june-platonov-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Платонов Данил Александрович",
        "start": "2026-06-09T12:00:00+00:00",
        "end": "2026-06-10T12:00:00+00:00",
        "total_cost": 10000,
        "duration_note": "«с двенадцати до одиннадцати [следующего дня]» = сутки 12:00→12:00",
        "confidence": "medium",
        "note": ("[06:15] «9 Июнь Платонов Данил Александрович, секундзера с двенадцати до одиннадцать "
                 "числа…» + [06:25 coarse] «10,000 rubles». Платонов — повторный клиент (14-16.04 Zero "
                 "30 000, 16.05 Falcon Pro 12 000)."),
    },
    {
        "_tag": "june-tomashevsky-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Томашевский Николай Михайлович",
        "start": "2026-06-10T09:00:00+00:00",
        "end": "2026-06-11T09:00:00+00:00",
        "total_cost": 10000,
        "duration_note": "«с десятого по одиннадцатый июня» = сутки",
        "confidence": "high",
        "note": ("[06:45-06:55] «tenth of June, Tomashovsky Nikolai Mikhailovich, Ducati Panigale S "
                 "Electro» + «с девятого-десятого июня по одиннадцатый июнь. Десять тысяч»."),
    },
    {
        "_tag": "june-mitnikov-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Митников Дмитрий Михайлович",
        "start": "2026-06-09T09:00:00+00:00",
        "end": "2026-06-13T19:00:00+00:00",
        "total_cost": 5000,
        "duration_note": "«с девяти по тринадцать числа» = с 9 по 13 июня (долгий срок); время стандартное",
        "confidence": "low",
        "note": ("[07:25-07:45] «Митников Дмитрий Михайлович, тоже Дукати С… с девяти по тринадцать "
                 "числа… пять тысяч рублей» + телефон «8-920-?0-50…» (нечитаем, не вставлен). 5 000 за "
                 "4 дня Панигале НЕ согласуется с ценами — либо байк другой, либо дата/цена иные. "
                 "ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ (вставлен ради полноты, помечен low)."),
    },
    {
        "_tag": "june-morozov-horwin",
        "vehicle_id": "horwin-cr1",
        "renter_name": "Морозов Сергей Сергеевич",
        "start": "2026-06-16T13:00:00+00:00",
        "end": "2026-06-16T15:00:00+00:00",
        "total_cost": 6500,
        "duration_note": "«13:00, 15:00» = 13:00→15:00 (2 часа)",
        "confidence": "low",
        "note": ("[07:55-08:15] «16-е, Морозов Сергей [Сергеевич], Хорвин ЕКА-1, 13:00, 15:00, 650» + "
                 "телефон «8-90?-384-71-74» (нечитаем). ЕКА-1 → horwin-cr1 (см. Шимину). «650» → 6 500 "
                 "за 2 ч. Дата «16-е» слышна в двух независимых чтениях («2016年» дважды)."),
    },
    {
        "_tag": "june-sasov-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Сасов Никита Алексеевич",
        "start": "2026-06-13T16:00:00+00:00",
        "end": "2026-06-13T20:00:00+00:00",
        "total_cost": 4000,
        "duration_note": "«с шестнадцати до восьми» = 16:00→20:00 (4 часа)",
        "confidence": "medium",
        "note": ("[08:35-08:45] «13-е, Сасов [Сусалов?] Никита Алексеевич брал секундзеро с четырех до "
                 "[восьми]… четырех тысяч рублей». Фамилия: fine «Сасов», coarse «Сусалов» — взято fine."),
    },
    {
        "_tag": "june-sv-breakout",
        "vehicle_id": "motoland-breakout",
        "renter_name": "Сергей Владимирович (фамилия не продиктована)",
        "start": "2026-06-13T12:00:00+00:00",
        "end": "2026-06-13T15:30:00+00:00",
        "total_cost": 5000,
        "duration_note": "«с двенадцати до пятнадцати тридцать» = 12:00→15:30 (3,5 часа)",
        "confidence": "low",
        "note": ("[08:55] «Следующие, тринадцатое июня, [ФАМИЛИЯ?] Сергей Владимирович, Мотoland "
                 "Брейкот 300, с 12 до 15:30, пять тысяч рублей». Фамилия выпала из обоих чтений — "
                 "ТРЕБУЕТ ДОПОЛНЕНИЯ."),
    },
    {
        "_tag": "june-kiselev-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Киселёв Андрей Васильевич",
        "start": "2026-06-13T10:00:00+00:00",
        "end": "2026-06-13T14:50:00+00:00",
        "total_cost": None,
        "duration_note": "«с 10 до 14:50» = 10:00→14:50 (4 ч 50 м)",
        "confidence": "medium",
        "note": ("[09:05-09:25] «тринадцатое июня Панигале S мотоцикл, Кисера/Киселёв Андрей "
                 "Васильевич, брал с 10 до 14:50» + «It's not fourteen. It's only…». ЦЕНА НЕ "
                 "ПРОДИКТОВАНА/не распознана — total_cost=null, добавлю при повторе."),
    },
    {
        "_tag": "june-balonin-honda",
        "vehicle_id": "honda-cbr600rr-2003",
        "renter_name": "Балонин Иван Константинович",
        "start": "2026-06-16T12:00:00+00:00",
        "end": "2026-06-16T20:00:00+00:00",
        "total_cost": 9000,
        "duration_note": "«с двенадцати до двадцати [часов]» = 12:00→20:00 (8 часов); 8 000 + 1 000 экип",
        "confidence": "medium",
        "note": ("[09:35-09:45] «Балонин [Валонин?] Иван Константинович брал Хонда «Дива» — 8000 плюс "
                 "1000 экип». «Хонда Дива» в парке нет → замаплено на honda-cbr600rr-2003 "
                 "(единственная Хонда) с пометкой; если «Дива» отдельный байк — одна правка "
                 "vehicle_id. Экип +1 000 учтён в total и specs.equip_rub."),
        "equip_rub": 1000,
    },
    {
        "_tag": "june-kuzavakov-kawasaki",
        "vehicle_id": "kawasaki-ex650k",
        "renter_name": "Кузаватов Евгений Александрович",
        "start": "2026-06-16T20:40:00+00:00",
        "end": "2026-06-17T12:00:00+00:00",
        "total_cost": 10000,
        "duration_note": "«двадцать сорок до полудни» = 20:40→12:00 следующего дня",
        "confidence": "medium",
        "note": ("[09:55-10:15] «16 Июня Кузаватов [Кузнецов?] Евгений Александрович брал Кавасаки "
                 "ИКС-сто-пятьдесят [EX650?]» + «10 тыщ». Фамилия спорна (единственное чтение)."),
    },
    {
        "_tag": "june-baykin-breakout",
        "vehicle_id": "motoland-breakout",
        "renter_name": "Байкин Олег Евгеньевич",
        "start": "2026-06-16T07:00:00+00:00",
        "end": "2026-06-16T17:00:00+00:00",
        "total_cost": 6000,
        "duration_note": "«с семи до семнадцати» = 07:00→17:00 (10 часов)",
        "confidence": "medium",
        "note": ("[10:25-10:35] «Байкин Олег Евгеньич, [Мотоленд] Брейкот триста, брал с семи до "
                 "семнадцати… шесть тысяч рублей, то есть шестнадцатое [июня]»."),
    },
    {
        "_tag": "june-sharin-panigale",
        "vehicle_id": BLACK_Z,
        "renter_name": "Шарин Денис Сергеевич",
        "start": "2026-06-16T15:00:00+00:00",
        "end": "2026-06-16T18:00:00+00:00",
        "total_cost": 5000,
        "duration_note": "«с трех до шести» = 15:00→18:00 (3 часа)",
        "confidence": "medium",
        "note": ("[10:45-11:05] «шестнадцатый июнь Шарин Денил Сергеевич брал дукути Понигали SZ, как "
                 "обычно, с трех до шести. Пять тысяч рублей». «SZ» → Black Z (как обычно)."),
    },
    {
        "_tag": "june-raev-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Раев Дмитрий Алексеевич",
        "start": "2026-06-16T17:00:00+00:00",
        "end": "2026-06-16T18:00:00+00:00",
        "total_cost": 7000,
        "duration_note": "«с пятых до шестых» = 17:00→18:00 (1 час)",
        "confidence": "medium",
        "note": ("[11:15-11:25] «Раев Дмитрий Алексеевич, Секвенция Зеро с пятых до шестых». Цена: "
                 "coarse «Семь тысяч», fine «6000» — взято coarse 7 000."),
    },
    {
        "_tag": "june-emko-r7",
        "vehicle_id": "yamaha-r7",
        "renter_name": "Емко Михаил Сергеевич",
        "start": "2026-06-16T10:30:00+00:00",
        "end": "2026-06-16T22:30:00+00:00",
        "total_cost": 9000,
        "duration_note": "«с 10:30 до 10:30 вечера» = 10:30→22:30, «за 12 часов»",
        "confidence": "high",
        "note": ("[11:35 coarse] «16 июня, Михаил Сергеевич Емко, R7 с 10:30 до 10:30 вечера. Девять "
                 "тысяч рублей за 12 часов» — чистое чтение."),
    },
    {
        "_tag": "june-mihailov-1199",
        "vehicle_id": "ducati-1199-panigale-2012",
        "renter_name": "Михайлов Александр Николаевич",
        "start": "2026-06-21T14:00:00+00:00",
        "end": "2026-06-21T16:00:00+00:00",
        "total_cost": None,
        "duration_note": "«с двух до четырех» = 14:00→16:00 (2 часа)",
        "confidence": "medium",
        "note": ("[12:05-12:15] «21 Июня Михайлов Александр Николаевич, Дукати Панигале [1199?] СС, с "
                 "двух до четырех». ЦЕНА не распознана — total_cost=null. «СС» без «электро» → "
                 "замаплено на 1199 Panigale; если S-Electro — одна правка vehicle_id."),
    },
    {
        "_tag": "june-smirnov-breakout",
        "vehicle_id": "motoland-breakout",
        "renter_name": "Смирнов Виктор Владимирович",
        "start": "2026-06-26T07:00:00+00:00",
        "end": "2026-06-27T07:00:00+00:00",
        "total_cost": 7000,
        "duration_note": "«с 7 до 7 следующего дня» = сутки",
        "confidence": "medium",
        "note": ("[15:00-15:10] «26 Июня, Смирнов Виктор Владимирович, Мотоленд Брейкот 300, с 7 до 7 "
                 "следующего дня… Семь тысяч»."),
    },
    {
        "_tag": "june-dolinsky-jilang",
        "vehicle_id": "jilang-max-pro",
        "renter_name": "Долинский Виталий Александрович",
        "start": "2026-06-28T11:00:00+00:00",
        "end": "2026-06-29T11:00:00+00:00",
        "total_cost": None,
        "duration_note": "«с одиннадцати утра до одиннадцатого утра следующего дня» = сутки",
        "confidence": "medium",
        "note": ("[15:20] «28 June, Долинский [Дмитрий/Виталий] Александрович брал Джилан с 11 утра "
                 "до 11 утра следующего дня». Имя: coarse «Виталий», fine «Dmitri» — взято coarse. "
                 "ЦЕНА не распознана (после была «20 тысячи рублей» — принадлежность неясна) — null."),
    },
    {
        "_tag": "june-shihaboddin-nibbler",
        "vehicle_id": "nibbler-regumoto-4v",
        "renter_name": "Шихабоддин Никифорович",
        "start": "2026-06-23T12:00:00+00:00",
        "end": "2026-06-23T15:00:00+00:00",
        "total_cost": None,
        "duration_note": "«с двенадцати до трёх» = 12:00→15:00 (3 часа)",
        "confidence": "medium",
        "note": ("[13:50-14:00] «23 Июня, Шихабоддин Никифорович [fine: Никита Викторович], Ниббер, с "
                 "двенадцати до трёх». ЦЕНА не распознана — null. Отчество спорно."),
    },
]

# UPDATE: Голубев 1.06 — цена и время из диктовки (в строке 8d3dd4d8 было null/09-19h)
UPDATE_GOLUBEV = {
    "rental_id": "8d3dd4d8-9561-4bb5-9c4e-52ec71e7bf10",  # уточняется по DB-lookup (vehicle+date+renter)
    "lookup": {"vehicle_id": BLACK_Z, "day": "2026-06-01", "renter_name": "Голубев Валерий Юрьевич"},
    "total_cost": 2000,
    "start": "2026-06-01T15:30:00+00:00",
    "end": "2026-06-01T16:30:00+00:00",
    "history_note": ("total_cost null→2000 + время →15:30-16:30: диктовка 26.10.2026 (june full.mp3) — "
                     "«первый июнь Голубев Валерий Юрьевич, Дукати Зет, с 15:30 до 16:30, сумма две тысячи»"),
}


def rest(table, params, method="GET", body=None, prefer=None):
    items = params.items() if isinstance(params, dict) else params
    qs = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}"
                  for k, v in items) if params else ""
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{qs}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    if method != "GET":
        req.get_method = lambda: method
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def rental_payload(r):
    md = {
        "source": "retro_backfill_audio_v3",
        "created_by": "audio-backfill-task144",
        "renter_name": r["renter_name"],
        "duration_note": r["duration_note"],
        "history": [
            {"at": NOW, "by": "task144-june-backfill", "status": "completed",
             "note": "retrospective insert from boss voice note 26.10.2026 (june full.mp3, ASR)"}
        ],
        "specs": {
            "retro_backfill_audio_v3": {
                "origin": ORIGIN,
                "row_tag": r["_tag"],
                "mapped_from": r["note"],
                "confidence": r["confidence"],
                "operator": "djorudjov (7813830016) — босс: «operator is djorudjov»",
                "backfilled_at": NOW,
                "backfilled_by": "task144 (agent, boss request: june full dictation — add properly, no duplicates)",
            }
        },
    }
    if r.get("equip_rub"):
        md["specs"]["retro_backfill_audio_v3"]["equip_rub"] = r["equip_rub"]
    if r.get("renter_phone"):
        md["renter_phone"] = r["renter_phone"]
    return {
        "user_id": WALKIN_USER,
        "vehicle_id": r["vehicle_id"],
        "owner_id": WALKIN_USER,
        "created_by_operator_chat_id": OPERATOR_DJORUDJOV,
        "status": "completed",
        "payment_status": "fully_paid",
        "total_cost": r["total_cost"],
        "requested_start_date": r["start"],
        "requested_end_date": r["end"],
        "agreed_start_date": r["start"],
        "agreed_end_date": r["end"],
        "created_at": r["start"],
        "updated_at": NOW,
        "crew_id": CREW_VIP_BIKE,
        "deposit_amount": 0,
        "deposit_returned": False,
        "metadata": md,
    }


def season_totals():
    rows = rest("rentals", [
        ("select", "vehicle_id,total_cost,requested_start_date"),
        ("crew_id", f"eq.{CREW_VIP_BIKE}"),
        ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
        ("requested_start_date", "lt.2026-11-01T00:00:00+00:00"),
    ])
    months = {}
    for x in rows:
        m = (x.get("requested_start_date") or "")[:7]
        if not m:
            continue
        svc = (x.get("vehicle_id") or "").startswith("vip-bike-svc")
        d = months.setdefault(m, {"rentals": 0, "service": 0, "rental_rub": 0, "service_rub": 0})
        cost = x.get("total_cost") or 0
        if svc:
            d["service"] += 1
            d["service_rub"] += cost
        else:
            d["rentals"] += 1
            d["rental_rub"] += cost
    return months


def print_totals():
    for m, d in sorted(season_totals().items()):
        print(f"  {m}: rentals={d['rentals']:>3} ({d['rental_rub']:>9,} ₽)  "
              f"service={d['service']:>2} ({d['service_rub']:>9,.2f} ₽)")


def main():
    print("=== DRY RUN — June rentals to insert ===")
    for r in RENTALS:
        p = rental_payload(r)
        print(f"[{r['_tag']}] {p['vehicle_id']} | {r['start'][:16]} .. {r['end'][:16]} | "
              f"{p['total_cost'] if p['total_cost'] is not None else 'NULL'}₽ | {r['renter_name']} | conf={r['confidence']}")
    print(f"\n[update] Голубев 1.06 → 2000₽, 15:30-16:30")

    print("\n=== idempotency check (existing task144 rows?) ===")
    existing = rest("rentals", [
        ("select", "rental_id,vehicle_id,requested_start_date,metadata"),
        ("crew_id", f"eq.{CREW_VIP_BIKE}"),
        ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
        ("requested_start_date", "lt.2026-11-01T00:00:00+00:00"),
    ])

    def has_v3(x):
        md = x.get("metadata") or {}
        return "retro_backfill_audio_v3" in (md.get("specs") or {})

    mine = [x for x in existing if has_v3(x)]
    print(f"  rows already carrying retro_backfill_audio_v3: {len(mine)}")

    print("\n=== season before: ===")
    print_totals()

    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply to insert.")
        return

    inserted = []
    print("\nrentals (per-row idempotent)…")
    for r in RENTALS:
        day = r["start"][:10]
        already = [x for x in mine
                   if x.get("vehicle_id") == r["vehicle_id"]
                   and (x.get("requested_start_date") or "")[:10] == day]
        if already:
            print(f"  skip [{r['_tag']}] — already inserted ({already[0]['rental_id']})")
            continue
        # collision guard: same vehicle+day with a DIFFERENT renter → proceed, same renter → abort
        others = [x for x in existing
                  if x.get("vehicle_id") == r["vehicle_id"]
                  and (x.get("requested_start_date") or "")[:10] == day]
        for x in others:
            other = (x.get("metadata") or {}).get("renter_name")
            if other == r["renter_name"]:
                raise SystemExit(f"DUPE risk: {r['vehicle_id']} {day} already has renter {other!r} ({x['rental_id']}) — abort")
        p = rental_payload(r)
        res = rest("rentals", {"select": "rental_id"}, method="POST", body=[p],
                   prefer="return=representation")
        rid = res[0]["rental_id"] if isinstance(res, list) and res else None
        inserted.append({"tag": r["_tag"], "rental_id": rid, "vehicle_id": r["vehicle_id"],
                         "total_cost": r["total_cost"], "kind": "rental",
                         "renter_name": r["renter_name"], "start": r["start"]})
        print(f"  inserted [{r['_tag']}] → {rid}")

    print("Голубев 1.06 update (idempotent)…")
    lk = UPDATE_GOLUBEV["lookup"]
    cur = [x for x in existing
           if x.get("vehicle_id") == lk["vehicle_id"]
           and (x.get("requested_start_date") or "")[:10] == lk["day"]]
    if not cur:
        raise SystemExit("Голубев row not found — abort")
    target = cur[0]
    md = (rest("rentals", [("select", "metadata,total_cost,requested_start_date,requested_end_date"),
                           ("rental_id", f"eq.{target['rental_id']}")]) or [{}])[0]
    meta = md.get("metadata") or {}
    specs = meta.setdefault("specs", {})
    if "retro_backfill_audio_v3" in specs:
        print(f"  skip — Голубев update already applied ({target['rental_id']})")
    else:
        hist = meta.setdefault("history", [])
        hist.append({"at": NOW, "by": "task144-june-backfill", "status": "completed",
                     "note": UPDATE_GOLUBEV["history_note"]})
        specs["retro_backfill_audio_v3"] = {
            "origin": ORIGIN,
            "row_tag": "june-golubev-panigale-update",
            "confidence": "high",
            "mapped_from": "диктовка: «первый июнь Голубев Валерий Юрьевич, Дукати Зет, с 15:30 до 16:30, сумма две тысячи»",
            "backfilled_at": NOW,
            "backfilled_by": "task144 (agent)",
        }
        rest("rentals", [("rental_id", f"eq.{target['rental_id']}")], method="PATCH",
             body={"total_cost": UPDATE_GOLUBEV["total_cost"],
                   "requested_start_date": UPDATE_GOLUBEV["start"],
                   "requested_end_date": UPDATE_GOLUBEV["end"],
                   "agreed_start_date": UPDATE_GOLUBEV["start"],
                   "agreed_end_date": UPDATE_GOLUBEV["end"],
                   "metadata": meta, "updated_at": NOW})
        inserted.append({"tag": "june-golubev-update", "rental_id": target["rental_id"],
                         "total_cost": UPDATE_GOLUBEV["total_cost"], "kind": "update"})
        print(f"  updated {target['rental_id']} → 2000₽ 15:30-16:30")

    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "task144-june-backfill-manifest.json")
    with open(manifest_path, "w") as f:
        json.dump({"applied_at": NOW,
                   "source": "boss voice note 26.10.2026 «26 окт. 18.45 june full.mp3» (ASR: 43 coarse + 101 fine chunks)",
                   "dedupe_base": "9 existing june rows (Голубев 1.06, Шаронов 5.06, nibbler 17/20/21.06, suzuki x3 20.06, Ларин 29.06)",
                   "operator_attribution": OPERATOR_DJORUDJOV,
                   "inserted": inserted,
                   "dedupe_hits_skipped": [
                       "Шаронов 5-6.06 EX650 10 000 — уже в БД (6adc56df, task108 xlsx row13); диктовка подтверждает 10 000",
                       "Ларин Алексей Александрович 29.06 — уже в БД (38ab65f2 aprilia-shiver 6500); НО диктовка говорит «БМВ Ф800, с 6:30 до 9:30, за 8 000» — РАСХОЖДЕНИЕ (байк+цена+время), нужно слово босса",
                   ],
                   "held_not_inserted_needs_redictation": [
                       "Бочкарев Роман Андреевич ~21.06 — «электро»-байк неопознан (не секвензер по манере речи), цена/время не читаются",
                       "Баринов Иван Александрович 13.06 — Кавасаки; время «с 6 до …»/цена «60…» — нечитаемо",
                       "Булатников Дмитрий Иванович — BMW F800R; дата (13-е? 23-е?), время (13-23 / 10:30-20:30), цена — конфликт чтений",
                       "Овчаров/Афанасьев Станислав Алексеевич ~24.06 — «Квасики XC50»?, «на два дня», цена нет",
                       "Березов/Безруков Юрий Алексеевич ~24.06 — только имя в зашумлённом чанке",
                       "Шаинский Михаил Владимирович — «вайвольт» (Y-VOLT Surge V?), «двадцать первый»?, цена «20 тысяч»? — привязка цены неясна",
                       "Лазарев/Лазарь [Валерий?] Сергеевич — Фалкон GT, дата (~29-30.06) и цена не распознаны",
                   ],
                   "phones_not_inserted_garbled": [
                       "Мельников 6.06 (8-920-205-… vs 8-920-059-…)",
                       "Шимина 6.06 (хвост «20 33 72 27»)",
                       "Митников 9-13.06 («8-920-?0-50…»)",
                       "Морозов 16.06 («8-90?-384-71-74»)",
                   ]}, f, ensure_ascii=False, indent=1)
    print(f"\nmanifest → {manifest_path}")

    print("\n=== season after: ===")
    print_totals()


if __name__ == "__main__":
    main()
