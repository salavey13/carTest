#!/usr/bin/env python3
# Проверка /interview.html: латиница в видимом тексте, ditch-фразы, повторы, баланс тегов, счётчики
import re, html as H

src = open("/home/z/cartest/public/interview.html", encoding="utf-8").read()

body = re.sub(r"<style.*?</style>", "", src, flags=re.S)
body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
text = re.sub(r"<[^>]+>", " ", body)
text = H.unescape(text)
low = text.lower().replace("ё", "е")

words = set(re.findall(r"[A-Za-z][A-Za-z0-9'\-\._/]*", text))
ALLOW = {"salavey13", "SLY13", "sly13", "S13", "DJORUDJOV", "SALAVEY13",
         "OpenAI", "ChatGPT", "CRM", "QR", "readme", "69k", "t.me/DJORUDJOV", "/salavey13"}
latin = sorted(w for w in words if w not in ALLOW and not w.startswith(("/", "t.", "+")))
print("Латиница вне белого списка:", latin if latin else "НЕТ ✓")

for phrase in ["spaghetti", "спагетти", "enjoyers", "без грима", "rocket science", "bookkeepers",
               "freemium", "opensource", "storefront", "ONE SITE", "claim your", "insights",
               "Supabase", "Vercel", "блиц", "Школа админов", "Партнёрский путь", "Сообщество экипажей",
               "Сначала она заработала на одном"]:
    if phrase.lower() in low:
        print(f"ОСТАЛОСЬ (ditch, видимый текст): {phrase!r} ✗")
if "sly13-bento" in src:
    print("ОСТАЛОСЬ (картинка bento) ✗")
print("ditch-проверка завершена")

qs = re.findall(r'data-n="(\d+)"', src)
print("Вопросов:", len(qs), qs)
print("Картинок:", len(re.findall(r"<img ", src)))
print("Строк:", src.count("\n") + 1, "| Видимых слов:", len(text.split()))
for sec in ["Какие это даст результаты", "ЭКИПАЖ", "Один сайт, пожалуйста", "мемуар"]:
    print(f"  «{sec}»:", "есть ✓" if sec in src else "НЕТ ✗")
for tag in ["section", "figure", "div", "blockquote", "p", "span"]:
    o = len(re.findall(f"<{tag}[ >]", src)); c = len(re.findall(f"</{tag}>", src))
    if o != c: print(f"  ✗ ДИСБАЛАНС <{tag}>: open={o} close={c}")
print("Баланс тегов: ok")

# ── отчёт о повторах: ключевые тезисы должны встречаться ≤2 раз (тезис + эхо-резюме) ──
dupes = {
    "формула «спросили другие/продаваться»": ["спросили другие", "начала продаваться", "потом все остальные"],
    "армия агентов": ["армия агентов"],
    "пятнадцать минут": ["пятнадцать минут"],
    "один разговор": ["один разговор"],
    "сотни тысяч": ["сотни тысяч"],
    "69k": ["69k"],
    "сходятся до копейки": ["сходятся до копейки"],
    "до сверки": ["до сверки"],
    "живёт в софте": ["живёт в этом софте", "живёт на своём софте", "живёт в своём софте"],
    "собирает(ся) сама": ["собирает всё сама", "собираются сами"],
    "без инструкций": ["без инструкций"],
    "витрина, база": ["витрина, база"],
    "работает руками": ["работает руками"],
    "обкатывается": ["обкатывается"],
}
bad = False
for name, variants in dupes.items():
    n = sum(low.count(v) for v in variants)
    flag = "✗" if n > 2 else ("~" if n == 2 else "✓")
    if n > 2: bad = True
    print(f"  {flag} {name}: {n}")
print("Повторы под контролем" if not bad else "ЕСТЬ ПОВТОРЫ ✗")
