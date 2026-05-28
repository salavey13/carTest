"use server";

import { createHash } from "crypto";
import { registerVerifierOriginalForBuffer } from "@/app/doc-verifier/actions";
import { generateDocxBytes } from "@/app/markdown-doc/actions";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { htmlToDocxElements } from "@/lib/htmlToDocx";
import { logger } from "@/lib/logger";
import { runLegalTemplateChecklist, TemplateIntegrityError } from "@/app/franchize/lib/legalChecklist";
import { Document, Packer, Paragraph, TextRun } from "docx";

type TemplateVariables = Record<string, string | number>;

export interface BuildFranchizeDocxInput {
  integrationScope: string;
  uploadedBy: string;
  documentKey?: string;
  fileName: string;
  template: string;
  variables: TemplateVariables;
  flowType?: "rental" | "sale" | "mixed";
  /** If set, template is HTML — use proper HTML→DOCX conversion */
  templateMode?: "md" | "html";
}

export interface BuildFranchizeDocxOutput {
  bytes: Uint8Array;
  renderedMarkdown: string;
  sha256: string;
  verifierRecordId?: string;
}

export async function buildFranchizeDocxFromTemplate(input: BuildFranchizeDocxInput): Promise<BuildFranchizeDocxOutput> {
  if (input.flowType === "rental") {
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

  const templateMode = input.templateMode ?? "md";

  let bytes: Uint8Array;
  let renderedMarkdown: string;

  if (templateMode === "html") {
    // ── HTML pipeline: proper cheerio-based HTML→DOCX ──
    const renderedHtml = applyTemplateVariables(input.template, input.variables);
    renderedMarkdown = renderedHtml; // Store rendered HTML for reference (field name is legacy)

    try {
      const children = htmlToDocxElements(renderedHtml);
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1134,    // 2 cm
                right: 1134,
                bottom: 1134,
                left: 1701,   // 3 cm (Russian GOST)
              },
            },
          },
          children,
        }],
      });
      bytes = await Packer.toBuffer(doc);
      logger.info("[franchize-docx] HTML\u2192DOCX: proper cheerio conversion (formatting preserved)", {
        integrationScope: input.integrationScope,
      });
    } catch (error) {
      // Fallback: strip tags and use old markdown pipeline
      logger.warn("[franchize-docx] HTML\u2192DOCX failed, falling back to plain-text pipeline", error);
      const stripped = renderedHtml
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\s*\/p\s*>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      renderedMarkdown = stripped;
      bytes = await generateDocxBytes(stripped);
    }
  } else {
    // ── Markdown pipeline: unchanged existing path ──
    renderedMarkdown = applyTemplateVariables(input.template, input.variables);
    bytes = await generateDocxBytes(renderedMarkdown);
  }

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
