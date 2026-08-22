import { describe, expect, it } from "vitest";

import {
  LEGAL_TEMPLATE_REQUIRED_MARKERS,
  TemplateIntegrityError,
  runLegalTemplateChecklist,
} from "@/app/franchize/lib/legalChecklist";

describe("runLegalTemplateChecklist", () => {
  it("passes when all required markers exist", () => {
    const fullTemplate = LEGAL_TEMPLATE_REQUIRED_MARKERS.join("\n");
    const result = runLegalTemplateChecklist(fullTemplate);

    expect(result.ok).toBe(true);
    expect(result.criticalIssues).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns template_integrity_failed diagnostics for missing critical markers", () => {
    const template = "§3.3\n§4.3\nПриложение №1\nПриложение №2\nПриложение №3\nПриложение №4";
    const result = runLegalTemplateChecklist(template);

    expect(result.ok).toBe(false);
    expect(result.criticalIssues.map((issue) => issue.marker)).toEqual([
      "§5.1",
      "§6.1",
      "§7.1",
      "§8.1",
      "§9.1",
      "§10.1",
      "§11.1",
      "§12.1",
    ]);

    const err = new TemplateIntegrityError(result);
    expect(err.code).toBe("template_integrity_failed");
    expect(err.message).toContain("missing critical markers");
    expect(err.diagnostics.criticalIssues).toHaveLength(8);
  });

  it("keeps non-blocking markers as warnings", () => {
    const template = LEGAL_TEMPLATE_REQUIRED_MARKERS.filter((marker) => marker !== "Приложение №3" && marker !== "Приложение №4").join("\n");
    const result = runLegalTemplateChecklist(template);

    expect(result.ok).toBe(true);
    expect(result.criticalIssues).toHaveLength(0);
    expect(result.warnings.map((issue) => issue.marker)).toEqual(["Приложение №3", "Приложение №4"]);
  });
});
