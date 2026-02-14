---
name: homework-ocr-intake
description: Use for Telegram homework tasks where `/codex` receives photo assignments; standardizes OCR extraction and clarification strategy for 7th-grade RU-first responses.
---

# Homework OCR Intake Skill

Use this skill when the task starts from Telegram `/codex` with one or more homework photos.

## Goal
Convert a noisy homework screenshot into a reliable, structured assignment draft that can be solved safely.

## Broader picture
This stage is not only "text extraction". It is the trust gate for the whole homework pipeline:
- better OCR quality -> fewer wrong solutions;
- clearer uncertainty handling -> fewer fabricated answers;
- structured extraction -> faster downstream PDF lookup.

## Input contract
Expect:
- raw photo (or photo URL),
- optional user text/caption,
- Telegram origin metadata (`telegramChatId`, `telegramUserId`).

## Output contract
Return normalized JSON draft:

```json
{
  "subject": "algebra|geometry|unknown",
  "grade": 7,
  "sourceLanguage": "ru",
  "detectedItems": [
    {
      "exercise": "№ 123",
      "topicHint": "линейные уравнения",
      "rawLine": "Алгебра: №123(а,б)",
      "confidence": 0.86
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null
}
```

## Workflow
1. OCR the full image.
2. Split by lines and detect subject markers (`алг`, `геом`, `№`, `п.`, `стр.`).
3. Normalize exercise identifiers (`123`, `123а`, `123(а,б)`).
4. Assign per-line confidence.
5. If confidence is low (<0.65 for critical lines), switch to clarification mode.

## Clarification mode
If OCR is uncertain, **do not invent** the assignment.
Return a short RU-first clarification prompt, e.g.:
- "На фото не читается номер задания после '№ 241'. Пришли, пожалуйста, более чёткий снимок строки с номером."

## Guardrails
- Never fabricate unreadable symbols or numbers.
- Never silently merge two different subject lines.
- Preserve `rawLine` for auditability.
