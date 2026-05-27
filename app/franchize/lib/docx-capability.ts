"use server";

import { createHash } from "crypto";
import { registerVerifierOriginalForBuffer } from "@/app/doc-verifier/actions";
import { generateDocxBytes } from "@/app/markdown-doc/actions";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { logger } from "@/lib/logger";
import { runLegalTemplateChecklist, TemplateIntegrityError } from "@/app/franchize/lib/legalChecklist";

type TemplateVariables = Record<string, string | number>;

export interface BuildFranchizeDocxInput {
  integrationScope: string;
  uploadedBy: string;
  documentKey?: string;
  fileName: string;
  template: string;
  variables: TemplateVariables;
  flowType?: "rental" | "sale" | "mixed";
}

export interface BuildFranchizeDocxOutput {
  bytes: Uint8Array;
  renderedMarkdown: string;
  sha256: string;
  verifierRecordId?: string;
}

export async function buildFranchizeDocxFromTemplate(input: BuildFranchizeDocxInput): Promise<BuildFranchizeDocxOutput> {
  if ((input.flowType ?? "rental") === "rental") {
    const checklist = runLegalTemplateChecklist(input.template);
    if (!checklist.ok) {
      logger.error("[franchize-docx] template integrity check failed", {
        integrationScope: input.integrationScope,
        missingCritical: checklist.criticalIssues.map((issue) => issue.marker),
        warnings: checklist.warnings.map((issue) => issue.marker),
      });
      throw new TemplateIntegrityError(checklist);
    }

    if (checklist.warnings.length > 0) {
      logger.warn("[franchize-docx] template integrity warnings", {
        integrationScope: input.integrationScope,
        warnings: checklist.warnings.map((issue) => issue.marker),
      });
    }
  }

  const renderedMarkdown = applyTemplateVariables(input.template, input.variables);
  const bytes = await generateDocxBytes(renderedMarkdown);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  let verifierRecordId: string | undefined;
  if (input.documentKey) {
    try {
      const registerResult = await registerVerifierOriginalForBuffer({
        integrationScope: input.integrationScope,
        documentKey: input.documentKey,
        sourceFileName: input.fileName,
        bytes,
        uploadedBy: input.uploadedBy,
      });
      verifierRecordId = registerResult.recordId;
      logger.info(
        `[franchize-docx] registered ${input.integrationScope} doc -> key: ${input.documentKey} | hash: ${sha256}`,
      );
    } catch (error) {
      logger.warn("[franchize-docx] verifier registration failed (non-critical)", error);
    }
  }

  return {
    bytes,
    renderedMarkdown,
    sha256,
    verifierRecordId,
  };
}
