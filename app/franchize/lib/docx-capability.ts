"use server";

import { createHash } from "crypto";
import { registerVerifierOriginal } from "@/app/doc-verifier/actions";
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
}

export async function buildFranchizeDocxFromTemplate(input: BuildFranchizeDocxInput): Promise<BuildFranchizeDocxOutput> {
  const renderedMarkdown = applyTemplateVariables(input.template, input.variables);
  const bytes = await generateDocxBytes(renderedMarkdown);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  if (input.documentKey) {
    const registerForm = new FormData();
    registerForm.append("integrationScope", input.integrationScope);
    registerForm.append("documentKey", input.documentKey);
    registerForm.append(
      "file",
      new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      input.fileName,
    );
    registerForm.append("uploadedBy", input.uploadedBy);

    try {
      await registerVerifierOriginal(registerForm);
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
  };
}
