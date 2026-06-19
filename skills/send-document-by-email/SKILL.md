---
name: send-document-by-email
description: >
  Send a generated .docx/.pdf document as an email attachment to a recipient
  (typically vip-bike@mail.ru). Use this skill whenever the user asks to
  "send by email", "email the document", "send to mail.ru", or when Telegram
  delivery fails and a fallback channel is needed. Triggers:
  "отправь письмом", "пришли на почту", "на email", "send via email".
---

# send-document-by-email (skill)

Триггер-фразы: **`отправь письмом`**, **`пришли на почту`**, **`на email`**,
**`send by email`**, **`email the document`**, **`send via email`**,
а также `ты босс` + email-delivery intent.

## Назначение

Отправка готового документа (`.docx`, `.pdf`, `.png`) как вложения на email
адрес. По умолчанию получатель — `vip-bike@mail.ru` (из env `EMAIL_DEFAULT_TO`
или хардкод). Отправитель — `vip-bike@mail.ru` (через SMTP mail.ru).

Используется как fallback когда:
- `TELEGRAM_BOT_TOKEN` отозван (401 Unauthorized)
- forward-telegram API недоступен (403 "Origin not allowed")
- пользователь явно просит отправить письмом

## CLI Usage

```bash
node scripts/send-document-by-email.mjs \
  --document /home/z/my-project/download/sale-contract-bike-Y-VOLT-Surge-V-19.06.2026.docx \
  --to vip-bike@mail.ru \
  --subject "Договор купли-продажи Y-VOLT Surge V — 19.06.2026" \
  --body "Во вложении договор купли-продажи. Цена 420 000 руб., покупатель: Резниченко Н.П."
```

### Required flags

| Flag | Description |
|------|-------------|
| `--document <path>` | Путь к файлу вложения (.docx / .pdf / .png / и т.д.) |

### Optional flags

| Flag | Default | Description |
|------|---------|-------------|
| `--to <email>` | `vip-bike@mail.ru` (или `EMAIL_DEFAULT_TO` env) | Получатель |
| `--subject <text>` | `Документ: <filename>` | Тема письма |
| `--body <text>` | `См. вложение.` | Текст письма |
| `--cc <email>` | — | Копия |
| `--bcc <email>` | — | Скрытая копия |
| `--from <email>` | `EMAIL_FROM` env или `vip-bike@mail.ru` | Отправитель |
| `--fromName <name>` | `VIP Bike` | Имя отправителя |

## Environment variables (CRITICAL)

Скрипт использует `nodemailer` и реальные SMTP-учётные данные mail.ru.
Без них отправка невозможна.

| Env | Required | Description |
|-----|----------|-------------|
| `SMTP_HOST` | ✅ | SMTP сервер (для mail.ru: `smtp.mail.ru`) |
| `SMTP_PORT` | ✅ | Порт (для mail.ru: `465` SSL или `587` STARTTLS) |
| `SMTP_USER` | ✅ | Логин (полный email: `vip-bike@mail.ru`) |
| `SMTP_PASS` | ✅ | Пароль приложения mail.ru (НЕ основной пароль аккаунта!) |
| `EMAIL_FROM` | опц. | Email отправителя (по умолчанию = `SMTP_USER`) |
| `EMAIL_DEFAULT_TO` | опц. | Получатель по умолчанию (если `--to` не передан) |

### Как получить пароль приложения mail.ru

1. Зайти в https://account.mail.ru/profile/security
2. В разделе «Пароли приложений» создать новый пароль
3. Скопировать 16-значный код в `SMTP_PASS`
4. Использовать как обычный пароль для SMTP

## Output (stdout JSON)

```json
{
  "ok": true,
  "messageId": "<message-id@mail.ru>",
  "from": "vip-bike@mail.ru",
  "to": "vip-bike@mail.ru",
  "subject": "Договор купли-продажи Y-VOLT Surge V — 19.06.2026",
  "attachment": "sale-contract-bike-Y-VOLT-Surge-V-19.06.2026.docx",
  "attachmentSizeBytes": 16110
}
```

При ошибке — JSON на stderr с `process.exit(2)`:

```json
{
  "ok": false,
  "stage": "smtp_auth" | "smtp_send" | "missing_document" | "missing_env",
  "reason": "auth_failed" | "send_failed" | "file_not_found" | "smtp_env_missing",
  "details": { ... }
}
```

## End-to-end pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. VALIDATE: проверить --document, прочитать env (SMTP_HOST/PORT/   │
│              USER/PASS)                                             │
│ 2. ATTACH: прочитать файл с диска, определить MIME по расширению    │
│ 3. COMPOSE: subject + body + attachment                             │
│ 4. SMTP: создать nodemailer transporter с SSL/STARTTLS              │
│ 5. SEND: вызвать transport.sendMail(), дождаться messageId          │
│ 6. RESULT: вывести JSON с messageId на stdout                       │
└─────────────────────────────────────────────────────────────────────┘
```

## MIME mapping

| Extension | MIME |
|-----------|------|
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.pdf` | `application/pdf` |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.html` | `text/html` |
| `.json` | `application/json` |
| `.txt` | `text/plain` |
| default | `application/octet-stream` |

## Security / Compliance

- **Никогда** не коммитить `.env` с `SMTP_PASS` в git
- В логах `SMTP_PASS` всегда маскировать (`****` + последние 4 символа)
- Письма отправляются ТОЛЬКО на явно указанный `--to` (или `EMAIL_DEFAULT_TO`)
- Содержимое вложения НЕ читается и НЕ модифицируется
- При невозможности отправить — вернуть ошибку, НЕ сохранять письмо локально

## Integration с deal-contract-from-photos

В `make-deal-contract-skill.mjs` можно добавить автоматический fallback
на email-отправку если Telegram-доставка упала. Пример патча:

```js
// После неудачной Telegram-доставки:
if (!json.ok && localDocPath) {
  console.error('[deal-contract] Trying email fallback...');
  const emailResult = spawnSync('node', [
    'scripts/send-document-by-email.mjs',
    '--document', localDocPath,
    '--to', 'vip-bike@mail.ru',
    '--subject', `Договор ${dealType} ${bike.id} — ${formatRuDate(new Date())}`,
    '--body', `Автоматическая отправка. Contract key: ${vars.document_key}`
  ], { encoding: 'utf8', cwd: process.cwd() });
  if (emailResult.status === 0) {
    const emailJson = JSON.parse(emailResult.stdout);
    if (emailJson.ok) {
      result.emailDelivered = true;
      result.emailMessageId = emailJson.messageId;
    }
  }
}
```

## Related files

- Script: `scripts/send-document-by-email.mjs`
- Dependencies: `nodemailer` (npm)
- Template env file: `.env` (must contain SMTP_*)
