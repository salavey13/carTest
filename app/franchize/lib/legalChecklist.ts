export const LEGAL_TEMPLATE_REQUIRED_MARKERS = [
  "§3.3",
  "§4.3",
  "§5.1",
  "§6.1",
  "§7.1",
  "§8.1",
  "§9.1",
  "§10.1",
  "§11.1",
  "§12.1",
  "Приложение №1",
  "Приложение №2",
  "Приложение №3",
  "Приложение №4",
] as const;

export type LegalChecklistSeverity = "critical" | "warning";

export interface LegalChecklistIssue {
  marker: string;
  severity: LegalChecklistSeverity;
  reason: string;
}

export interface LegalChecklistResult {
  ok: boolean;
  issues: LegalChecklistIssue[];
  criticalIssues: LegalChecklistIssue[];
  warnings: LegalChecklistIssue[];
}

const WARNING_PATTERN_GROUPS: { markers: readonly string[]; reason: string }[] = [
  {
    markers: ["Приложение №3", "Приложение №4"],
    reason: "Приложения с чеклистами/актами желательно держать в шаблоне для полноты юридического пакета.",
  },
];

function isWarningMarker(marker: string): boolean {
  return WARNING_PATTERN_GROUPS.some((group) => group.markers.includes(marker));
}

function warningReason(marker: string): string {
  const group = WARNING_PATTERN_GROUPS.find((entry) => entry.markers.includes(marker));
  return group?.reason ?? "Маркер отсутствует, рекомендуется добавить в шаблон.";
}

export function runLegalTemplateChecklist(template: string): LegalChecklistResult {
  const source = String(template ?? "");
  const issues: LegalChecklistIssue[] = LEGAL_TEMPLATE_REQUIRED_MARKERS
    .filter((marker) => !source.includes(marker))
    .map((marker) => {
      if (isWarningMarker(marker)) {
        return { marker, severity: "warning" as const, reason: warningReason(marker) };
      }
      return {
        marker,
        severity: "critical" as const,
        reason: "Ключевой юридический блок отсутствует в шаблоне договора.",
      };
    });

  const criticalIssues = issues.filter((issue) => issue.severity === "critical");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    ok: criticalIssues.length === 0,
    issues,
    criticalIssues,
    warnings,
  };
}

export class TemplateIntegrityError extends Error {
  code = "template_integrity_failed" as const;
  diagnostics: LegalChecklistResult;

  constructor(diagnostics: LegalChecklistResult) {
    const critical = diagnostics.criticalIssues.map((item) => item.marker).join(", ");
    const warning = diagnostics.warnings.map((item) => item.marker).join(", ");
    super(
      `template_integrity_failed: missing critical markers [${critical || "none"}]` +
      `${warning ? `; warnings [${warning}]` : ""}`,
    );
    this.name = "TemplateIntegrityError";
    this.diagnostics = diagnostics;
  }
}
