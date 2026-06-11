"use server";

import { createHash } from "crypto";
import { registerVerifierOriginalForBuffer } from "@/app/doc-verifier/actions";
import { generateDocxBytes } from "@/app/markdown-doc/actions";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { htmlToDocxDocument } from "@/lib/htmlToDocx";
import { logger } from "@/lib/logger";
import { runLegalTemplateChecklist, TemplateIntegrityError } from "@/app/franchize/lib/legalChecklist";
import { Packer } from "docx";

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
  /** Rendered template text (markdown for md mode, stripped text for html mode) */
  renderedMarkdown: string;
  /** When templateMode=html, stores the original rendered HTML for debugging */
  renderedHtml?: string;
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

  const templateMode = input.templateMode ?? "html";

  // Safety: ensure template and variables are not undefined
  if (!input.template) {
    throw new Error("[franchize-docx] input.template is required but was undefined");
  }
  const safeVariables: TemplateVariables = Object.fromEntries(
    Object.entries(input.variables ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])
  );

  let bytes: Uint8Array;
  let renderedMarkdown: string;
  let renderedHtml: string | undefined;

  if (templateMode === "html") {
    // ── HTML pipeline: proper cheerio-based HTML→DOCX ──
    const renderedHtmlRaw = applyTemplateVariables(input.template, safeVariables);
    renderedHtml = renderedHtmlRaw;

    // Strip HTML to plain text for the renderedMarkdown field (backward compat)
    renderedMarkdown = renderedHtmlRaw
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    try {
      const doc = htmlToDocxDocument(renderedHtmlRaw);
      bytes = await Packer.toBuffer(doc);
      logger.info("[franchize-docx] HTML\u2192DOCX: proper cheerio conversion (formatting preserved)", {
        integrationScope: input.integrationScope,
      });
    } catch (error) {
      // Fallback: use stripped text with the old markdown pipeline
      logger.warn("[franchize-docx] HTML\u2192DOCX failed, falling back to plain-text pipeline", error);
      bytes = await generateDocxBytes(renderedMarkdown);
    }
  } else {
    // ── Markdown pipeline: unchanged existing path ──
    renderedMarkdown = applyTemplateVariables(input.template, safeVariables);
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
    ...(renderedHtml ? { renderedHtml } : {}),
    sha256,
    verifierRecordId,
  };
}