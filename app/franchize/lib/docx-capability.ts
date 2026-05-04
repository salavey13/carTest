"use server";

import { createHash } from "crypto";
import { registerVerifierOriginalForBuffer } from "@/app/doc-verifier/actions";
import { generateDocxBytes } from "@/app/markdown-doc/actions";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { logger } from "@/lib/logger";

type TemplateVariables = Record<string, string | number>;

export interface BuildFranchizeDocxInput {
  integrationScope: string;
  uploadedBy: string;
  documentKey?: string;
  fileName: string;
  template: string;
  variables: TemplateVariables;
}

export interface BuildFranchizeDocxOutput {
  bytes: Uint8Array;
  renderedMarkdown: string;
  sha256: string;
  verifierRecordId?: string;
}

export async function buildFranchizeDocxFromTemplate(input: BuildFranchizeDocxInput): Promise<BuildFranchizeDocxOutput> {
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
