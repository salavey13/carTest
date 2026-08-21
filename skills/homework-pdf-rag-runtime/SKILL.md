---
name: homework-pdf-rag-runtime
description: Use for on-the-fly textbook lookup in `books/alg.pdf` and `books/geom.pdf` during `/codex` homework tasks without offline indexing.
---

# Homework PDF RAG Runtime Skill

Use this skill after OCR intake is completed and assignment items are normalized.

## Goal
Find relevant textbook context for each assignment item directly from local PDFs and produce grounded, student-ready solutions.

## Broader picture
This stage turns extracted homework lines into verifiable explanations:
- keeps answers tied to real textbook fragments,
- reduces hallucinations,
- enables source-aware "Что дано / Решение / Ответ" output,
- improves operator confidence when results are sent back via callback.

## Primary sources
- `books/alg.pdf` (Алгебра, 7 класс)
- `books/geom.pdf` (Геометрия, 7–9 класс)

## Runtime strategy (no offline index)
1. Choose candidate PDF by subject hint.
2. Search by exercise number patterns and nearby keywords.
3. Pull top candidate snippets (+ neighbouring text window).
4. Validate snippet-task match using semantic checks (numbers, entities, operation type).
5. Build solution grounded in matched snippet.
6. Emit source hints for transparency.

## Output contract

```json
{
  "status": "completed|needs_clarification|failed",
  "topic": "<short topic>",
  "given": "<what is asked>",
  "steps": ["..."],
  "answer": "...",
  "rewriteForNotebook": "...",
  "sourceHints": [
    { "book": "alg.pdf", "page": "123", "exercise": "241(б)", "chunkLabel": "near-ex-241" }
  ]
}
```

## Clarification policy
Use `needs_clarification` when:
- exercise number exists but statement is ambiguous,
- two candidate snippets are equally likely,
- OCR dropped critical symbols.

## Guardrails
- No fake page numbers.
- No confident final answer with weak snippet match.
- If multiple reasonable interpretations exist, list options and ask for one clarifying detail.


## Done criteria for homework-photo tasks
- Return computed final answers for all solvable numbered items found in photo/PDF.
- Separate unsolved items into `needs_clarification` with explicit reason.
- Plan-only output is invalid for completion callbacks.

- Include extracted statement text for each solved exercise in output `given`/`problemRestatement` (not only exercise numbers).
