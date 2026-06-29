"use server";

import { createHash } from "crypto";
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from "fs";
import { registerVerifierOriginalForBuffer } from "@/app/doc-verifier/actions";
import { generateDocxBytes } from "@/app/markdown-doc/actions";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { htmlToDocxElements } from "@/lib/htmlToDocx";
import { logger } from "@/lib/logger";
import { runLegalTemplateChecklist, TemplateIntegrityError } from "@/app/franchize/lib/legalChecklist";
import { Document, Packer } from "docx";

const TEMPLATE_HTML_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const STORAGE_BUCKET = 'rental-contracts';

type TemplateVariables = Record<string, string | number>;

export interface BuildFranchizeDocxInput {
  integrationScope: string;
  uploadedBy: string;
  documentKey?: string;
  fileName: string;
  template: string;
  variables: TemplateVariables;
  flowType?: "rental" | "sale" | "subrental" | "mixed";
  templateMode?: "md" | "html";
}

export interface BuildFranchizeDocxOutput {
  bytes: Uint8Array;
  renderedMarkdown: string;
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
    const renderedHtmlRaw = applyTemplateVariables(input.template, safeVariables);
    renderedHtml = renderedHtmlRaw;

    renderedMarkdown = renderedHtmlRaw
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    try {
      const children = htmlToDocxElements(renderedHtmlRaw);
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1134,
                right: 1134,
                bottom: 1134,
                left: 1701,
              },
            },
          },
          children,
        }],
      });
      bytes = await Packer.toBuffer(doc);
      logger.info("[franchize-docx] HTML→DOCX: proper cheerio conversion (formatting preserved)", {
        integrationScope: input.integrationScope,
      });
    } catch (error: any) {
      logger.warn("[franchize-docx] HTML→DOCX failed, falling back to plain-text pipeline", {
        error: error?.message || String(error),
        stack: error?.stack?.split('\n').slice(0, 3),
        integrationScope: input.integrationScope,
      });
      bytes = await generateDocxBytes(renderedMarkdown);
    }
  } else {
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

/**
 * Render template with vars and convert to DOCX buffer
 * Simplified version for rental contract generation
 */
export async function renderTemplateToDocx(vars: Record<string, string>): Promise<{
  buffer: Buffer;
  sha256: string;
}> {
  // Read template
  const htmlTemplate = readFileSync(TEMPLATE_HTML_PATH, 'utf8');

  // Render template with vars (supports {{#if}} conditionals)
  const renderedHtml = renderTemplateWithVars(htmlTemplate, vars);

  // Convert to DOCX elements
  const children = htmlToDocxElements(renderedHtml);

  // Create document
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

  // Pack to buffer
  const buf = await Packer.toBuffer(doc);
  const sha256 = createHash('sha256').update(buf).digest('hex');

  return { buffer: buf, sha256 };
}

/**
 * Simple template renderer with {{var}} and {{#if}}...{{else}}...{{/if}} support
 */
function renderTemplateWithVars(template: string, vars: Record<string, any>): string {
  let result = template;

  // Process {{#if var}}...{{else}}...{{/if}} blocks (innermost-first, max 50 depth)
  let depth = 0;
  while (/(?<={{#if\s+([a-zA-Z0-9_]+)}})/.test(result) && depth < 50) {
    result = result.replace(/{{#if\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (_, varName, ifBlock, elseBlock) => {
      const value = vars[varName];
      return value ? ifBlock : elseBlock;
    });
    depth++;
  }

  // Process simple {{var}} placeholders
  result = result.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => String(vars[key] ?? ''));

  return result;
}

/**
 * Upload DOCX to Supabase Storage
 */
export async function uploadDocxToStorage(params: {
  crewSlug: string;
  contractKey: string;
  buffer: Buffer;
  suffix?: string; // e.g., "_finished"
  metadata?: Record<string, any>;
}): Promise<{
  storagePath: string;
  downloadUrl: string;
}> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const filename = `${params.contractKey}${params.suffix || ''}.docx`;
  const storagePath = `${params.crewSlug}/${filename}`;

  const { data, error } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
      ...(params.metadata ? { options: { metadata: params.metadata } } : {}),
    });

  if (error) {
    throw new Error(`Failed to upload DOCX: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    downloadUrl: publicUrl,
  };
}

/**
 * Send DOCX via Telegram to multiple recipients
 */
export async function sendDocxViaTelegram(params: {
  buffer: Buffer;
  filename: string;
  chatIds: string[]; // Multiple recipients: renter + crew owner
  caption?: string;
}): Promise<{
  success: boolean;
  messageIds: string[];
  errors: Array<{ chatId: string; error: string }>;
}> {
  const messageIds: string[] = [];
  const errors: Array<{ chatId: string; error: string }> = [];

  for (const chatId of params.chatIds) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
      const form = new FormData();

      form.append('chat_id', chatId);
      form.append('document', new Blob([params.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }), params.filename);
      if (params.caption) {
        form.append('caption', params.caption);
        form.append('parse_mode', 'HTML');
      }

      const response = await fetch(url, { method: 'POST', body: form });
      const body = await response.json();

      if (!body.ok) {
        errors.push({ chatId, error: body.description || 'Unknown error' });
      } else {
        messageIds.push(body.result.message_id);
      }
    } catch (error) {
      errors.push({ chatId, error: (error as Error).message });
    }
  }

  return {
    success: errors.length === 0,
    messageIds,
    errors,
  };
}

/**
 * Delete DOCX from Storage
 */
export async function deleteDocxFromStorage(storagePath: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const { error } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete DOCX ${storagePath}:`, error);
  }
}