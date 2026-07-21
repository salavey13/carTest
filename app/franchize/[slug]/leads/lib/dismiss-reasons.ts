export const DISMISS_REASONS: Array<{ value: string; label: string; requiresNote: boolean }> = [
  { value: "not_interested", label: "Не заинтересован", requiresNote: false },
  { value: "unreachable", label: "Недозвон / не отвечает", requiresNote: false },
  { value: "wrong_contact", label: "Неверный контакт", requiresNote: false },
  { value: "booked_elsewhere", label: "Арендовал в другом месте", requiresNote: false },
  { value: "documents_missing", label: "Не предоставил документы", requiresNote: false },
  { value: "timing_issue", label: "Не подошли даты", requiresNote: false },
  { value: "operator_error", label: "Ошибка оператора", requiresNote: true },
  { value: "duplicate", label: "Дубликат", requiresNote: false },
  { value: "test_lead", label: "Тестовый лид", requiresNote: false },
  { value: "other", label: "Другое", requiresNote: true },
];
