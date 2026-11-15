#!/usr/bin/env python3
# Проверка /interview.html: латинские слова в видимом тексте + ditch-фразы + счётчик вопросов
import re, html as H

src = open("/home/z/cartest/public/interview.html", encoding="utf-8").read()

# вырезаем style/script, оставляем body-текст
body = re.sub(r"<style.*?</style>", "", src, flags=re.S)
body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
text = re.sub(r"<[^>]+>", " ", body)
text = H.unescape(text)

words = set(re.findall(r"[A-Za-z][A-Za-z0-9'\-\._/]*", text))
ALLOW = {
    "salavey13", "SLY13", "sly13", "S13", "DJORUDJOV", "SALAVEY13",
    "OpenAI", "ChatGPT", "CRM", "QR", "readme", "69k",
    "t.me/DJORUDJOV", "/salavey13",
}
latin = sorted(w for w in words if w not in ALLOW and not w.startswith(("/", "t.", "+")))
print("Латинские слова вне белого списка:", latin if latin else "НЕТ ✓")

# ditch-фразы не должны существовать нигде в файле
for phrase in ["spaghetti", "спагетти", "enjoyers", "без грима", "пообещал посмотреть",
               "rocket science", "flow", "crew", "CREW", "bookkeepers", "steroids",
               "freemium", "opensource", "self-explanatory", "basics", "storefront",
               "ONE SITE", "oneSitePls", "claim your", "insights", "Supabase", "Vercel",
               "multi-crew", "One platform"]:
    if phrase.lower() in src.lower():
        print(f"ОСТАЛОСЬ (ditch): {phrase!r} ✗")
print("ditch-проверка завершена")

qs = re.findall(r'data-n="(\d+)"', src)
print("Вопросов:", len(qs), qs)
for sec in ["Какие это даст результаты", "ЭКИПАЖ", "Один сайт, пожалуйста", "тезисно"]:
    print(f"  «{sec}»:", "есть ✓" if sec in src else "НЕТ ✗")
# баланс тегов
for tag in ["section", "figure", "div", "blockquote"]:
    o = len(re.findall(f"<{tag}[ >]", src)); c = len(re.findall(f"</{tag}>", src))
    print(f"  <{tag}>: open={o} close={c}", "✓" if o == c else "✗ ДИСБАЛАНС")
print("Картинок img:", len(re.findall(r"<img ", src)))
print("Строк всего:", src.count("\n") + 1)
