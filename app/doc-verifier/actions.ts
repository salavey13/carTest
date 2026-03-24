"use server";

import { createHash, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

const DOC_BUCKET = "doc-verifier";
const DOC_TABLE = "doc_verifier_records";

type VerifyResult = {
  success: boolean;
  error?: string;
  documentKey?: string;
  uploadedHash?: string;
  storedHash?: string;
  storageHash?: string;
  verifiedAt?: string;
  matches?: boolean;
  storageIntact?: boolean;
};

function sanitizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").slice(0, 80);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets ?? []).some((bucket) => bucket.name === DOC_BUCKET);
  if (exists) return;
  await supabaseAdmin.storage.createBucket(DOC_BUCKET, { public: false, fileSizeLimit: 15 * 1024 * 1024 });
}

async function upsertVerifierRecord(input: {
  integrationScope: string;
  documentKey: string;
  sourceFileName: string;
  originalPath: string;
  originalHash: string;
  uploadedBy: string;
}) {
  const { error } = await supabaseAdmin.from(DOC_TABLE).upsert(
    {
      integration_scope: input.integrationScope,
      document_key: input.documentKey,
      source_file_name: input.sourceFileName,
      original_storage_path: input.originalPath,
      original_sha256: input.originalHash,
      uploaded_by: input.uploadedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "integration_scope,document_key" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerVerifierOriginal(formData: FormData): Promise<VerifyResult> {
  const integrationScope = sanitizeKey(String(formData.get("integrationScope") || "core"));
  const rawKey = String(formData.get("documentKey") || "");
  const documentKey = sanitizeKey(rawKey);
  const file = formData.get("file");
  const uploadedBy = String(formData.get("uploadedBy") || "manual");

  if (!documentKey) return { success: false, error: "Введите document key" };
  if (!(file instanceof File)) return { success: false, error: "Прикрепите DOCX файл" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = sha256(bytes);
  const extension = file.name.toLowerCase().endsWith(".docx") ? ".docx" : "";
  const storagePath = `${documentKey}/original-${Date.now()}-${randomUUID()}${extension}`;

  await ensureBucket();
  const { error: uploadError } = await supabaseAdmin.storage.from(DOC_BUCKET).upload(storagePath, bytes, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  try {
    await upsertVerifierRecord({
      documentKey,
      integrationScope,
      sourceFileName: file.name,
      originalPath: storagePath,
      originalHash: hash,
      uploadedBy,
    });
    return { success: true, documentKey, uploadedHash: hash, verifiedAt: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "DB upsert failed" };
  }
}

export async function verifyDocAgainstStored(formData: FormData): Promise<VerifyResult> {
  const integrationScope = sanitizeKey(String(formData.get("integrationScope") || "core"));
  const rawKey = String(formData.get("documentKey") || "");
  const documentKey = sanitizeKey(rawKey);
  const file = formData.get("file");
  if (!documentKey) return { success: false, error: "Введите document key" };
  if (!(file instanceof File)) return { success: false, error: "Прикрепите DOCX файл для проверки" };

  const { data: record, error } = await supabaseAdmin
    .from(DOC_TABLE)
    .select("document_key, original_sha256, original_storage_path")
    .eq("integration_scope", integrationScope)
    .eq("document_key", documentKey)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!record) return { success: false, error: "Оригинал не найден. Сначала зарегистрируйте оригинал." };

  const uploadedHash = sha256(Buffer.from(await file.arrayBuffer()));
  const { data: storedBlob, error: downloadError } = await supabaseAdmin.storage.from(DOC_BUCKET).download(record.original_storage_path);
  if (downloadError || !storedBlob) {
    return { success: false, error: downloadError?.message || "Не удалось скачать оригинал из Storage" };
  }

  const storageHash = sha256(Buffer.from(await storedBlob.arrayBuffer()));
  const storedHash = String(record.original_sha256);
  const matches = uploadedHash === storedHash;
  const storageIntact = storageHash === storedHash;

  return {
    success: true,
    documentKey,
    uploadedHash,
    storedHash,
    storageHash,
    matches,
    storageIntact,
    verifiedAt: new Date().toISOString(),
  };
}
