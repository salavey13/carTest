---
name: audio-transcribe
description: "Транскрибация аудио/видео через Deepgram API: спикеры, таймкоды, форматированный .md"
---

# audio-transcribe — Транскрибация через Deepgram

Транскрибирует аудио/видео файл в форматированный Markdown с разметкой спикеров и таймкодами.
Deepgram Nova-3 (облако) — быстро, точно, диаризация из коробки.

## Требования

```bash
which ffmpeg ffprobe && echo "OK" || echo "MISSING: brew install ffmpeg"
echo ${DEEPGRAM_API_KEY:0:8}... && echo "API key set" || echo "MISSING: set DEEPGRAM_API_KEY"
```

## Быстрый старт

Пользователь даёт путь к файлу — выполнить:

```bash
export DEEPGRAM_API_KEY="${DEEPGRAM_API_KEY}"
bash ~/.claude/skills/audio-transcribe/transcribe.sh "/path/to/file.mp3" ru
```

Результат: `[имя]-transcript.md` рядом с исходным файлом.

## ⛔ ПРАВИЛО: Видео → MP3 → Deepgram (обязательно)

Любой видео-формат (включая `.webm`) — **сначала конвертируется в MP3** через ffmpeg, затем отправляется в Deepgram. НЕ отправлять видео-контейнеры напрямую.

**Почему:**
- MP3 стабильнее воспринимается Deepgram API, чем webm/opus
- Промежуточный MP3 остаётся у пользователя — можно прослушать, переслать, заархивировать
- Единый content-type для всей видео-категории — меньше веток логики

**Параметры конвертации (дефолт):**
```bash
ffmpeg -i "$INPUT" -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k -y "$OUTPUT.mp3"
```
Моно, 16kHz, 64kbps — этого достаточно для распознавания речи. 30 мин видео → ~14 МБ.

MP3 сохраняется рядом с исходником как `[имя].mp3` (не во временной папке — чтобы пользователь мог им воспользоваться).

---

## Что делает скрипт

1. Проверяет ffmpeg, python3, API ключ
2. ffprobe → длительность файла
3. Если видео (mp4/mkv/mov/avi/webm/wmv/flv) или >90 мин → **конвертирует в MP3** рядом с исходником
4. Отправляет в Deepgram API (POST с бинарным телом, Content-Type: audio/mpeg)
5. python3 парсит ответ — utterances → спикеры + таймкоды
6. Сохраняет Markdown файл: `**Спикер N** [MM:SS]: текст реплики`

## Поддерживаемые форматы

| Расширение | Путь до Deepgram | Конвертация |
|-----------|------------------|-------------|
| `.mp3` | напрямую (audio/mpeg) | нет |
| `.wav` | напрямую (audio/wav) | нет |
| `.ogg` `.opus` | напрямую (audio/ogg) | нет |
| `.m4a` | напрямую (audio/mp4) | нет |
| `.aac` | напрямую (audio/aac) | нет |
| `.flac` | напрямую (audio/flac) | нет |
| **`.webm`** | **→ MP3 → audio/mpeg** | **да (ffmpeg)** |
| `.mp4` `.mkv` `.mov` `.avi` `.wmv` `.flv` | → MP3 → audio/mpeg | да (ffmpeg) |

Deepgram принимает файлы до 2 ГБ.

## Языки

По умолчанию `ru`. Второй аргумент скрипта:

```bash
bash transcribe.sh file.mp3 en    # английский
bash transcribe.sh file.mp3 de    # немецкий
bash transcribe.sh file.mp3 fr    # французский
```

## Длинные файлы (>90 мин)

Скрипт автоматически конвертирует в opus (сжатие ~10x). Для экстремально длинных файлов — ручная нарезка:

```bash
INPUT="/path/to/long.mp4"
CHUNK=1500    # 25 мин
TMP=$(mktemp -d)
TOTAL=$(ffprobe -v quiet -print_format json -show_format "$INPUT" \
  | python3 -c "import json,sys; print(int(float(json.load(sys.stdin)['format']['duration'])))")

i=0; start=0
while [[ $start -lt $TOTAL ]]; do
  ffmpeg -ss $start -i "$INPUT" -t $CHUNK \
    -vn -acodec libopus -ar 16000 -ac 1 -b:a 32k -y "${TMP}/chunk_${i}.ogg" 2>/dev/null
  (( i++ )); (( start += CHUNK ))
done

for f in "${TMP}"/chunk_*.ogg; do
  bash ~/.claude/skills/audio-transcribe/transcribe.sh "$f" ru
done
cat "${TMP}"/*-transcript.md > merged-transcript.md
rm -rf "$TMP"
```

## Настройка DEEPGRAM_API_KEY

Скилл берёт ключ из переменной окружения `DEEPGRAM_API_KEY`.

Варианты:
1. **shell профиль:** `echo 'export DEEPGRAM_API_KEY=xxx' >> ~/.zshrc`
2. **settings.json env:** Claude Code пробрасывает `env` из settings в MCP, но не в shell. Для shell — вариант 1.

## Формат вывода

```markdown
# Транскрипт: filename.mp3

**Дата:** 2026-03-28 16:00
**Длительность:** 45 мин
**Спикеров:** 2
**Слов:** 3200

---

## Транскрипт

**Спикер 1** [00:00]: Привет, начинаем встречу...
**Спикер 2** [00:15]: Да, обсудим план на неделю.
**Спикер 1** [01:30]: Первый пункт — запуск рассылки.
```

## API Reference

```
POST https://api.deepgram.com/v1/listen
Headers: Authorization: Token ${KEY}, Content-Type: audio/*
Params: model=nova-3&language=ru&diarize=true&utterances=true&smart_format=true&punctuate=true&paragraphs=true

Response:
  .results.utterances[] → {speaker, start, transcript}  ← основной
  .results.channels[0].alternatives[0].paragraphs       ← fallback
  .results.channels[0].alternatives[0].transcript        ← plain text
  .metadata.duration → длительность в секундах
```

## Quick Reference

| Задача | Команда |
|--------|---------|
| Транскрибировать MP3 | `bash transcribe.sh file.mp3` |
| Английский | `bash transcribe.sh file.mp3 en` |
| Видео файл | `bash transcribe.sh video.mp4` |
| Проверить ключ | `curl -s -H "Authorization: Token $DEEPGRAM_API_KEY" https://api.deepgram.com/v1/projects` |
