/**
 * VPS OCR API Endpoint
 * 
 * Принимает фото из Supabase Storage, запускает OCR, обновляет user_rental_secrets.
 * Вызывается из WebApp (Vercel) в fire-and-forget режиме.
 * 
 * Flow:
 * 1. WebApp загружает фото в docpix bucket
 * 2. WebApp делает POST на этот endpoint с { storagePath, rentalId, docType, chatId }
 * 3. Этот endpoint скачивает фото, запускает OCR, обновляет user_rental_secrets
 * 4. Удаляет фото из docpix (152-ФЗ compliance)
 * 5. Пользователь видит заполненные поля в профиле автоматически
 * 
 * Примечание: этот endpoint должен работать на VPS (не Vercel), т.к. OCR может занимать 10-30 сек.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { recognizeDocument, type DocKind } from "@/app/lib/ocr-recognize";

export const runtime = "nodejs";
export const maxDuration = 60; // VPS не имеет ограничений, но ставим разумный timeout

interface OcrRequest {
  storagePath: string; // Путь в Supabase Storage (docpix bucket)
  rentalId: string;
  docType: "passport" | "license";
  chatId: string; // Telegram chat_id пользователя
}

interface OcrResponse {
  success: boolean;
  fields?: Record<string, string | null>;
  error?: string;
}

/**
 * Конвертирует ISO дату (YYYY-MM-DD) в DD.MM.YYYY (формат rental-repo).
 */
function isoToDmy(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso; // Уже в нужном формате или невалидная
  const [, y, m, d] = match;
  return `${d}.${m}.${y}`;
}

export async function POST(request: NextRequest): Promise<NextResponse<OcrResponse>> {
  let storagePath: string | undefined;
  
  try {
    // 1. Парсим входные данные
    const body = (await request.json()) as OcrRequest;
    const { rentalId, docType, chatId } = body;
    storagePath = body.storagePath;
    
    if (!storagePath || !rentalId || !docType || !chatId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: storagePath, rentalId, docType, chatId" },
        { status: 400 }
      );
    }
    
    if (docType !== "passport" && docType !== "license") {
      return NextResponse.json(
        { success: false, error: 'Invalid docType. Must be "passport" or "license"' },
        { status: 400 }
      );
    }
    
    // 2. Валидируем rental
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, user_id")
      .eq("rental_id", rentalId)
      .single();
    
    if (rentalError || !rental) {
      return NextResponse.json(
        { success: false, error: "Rental not found" },
        { status: 404 }
      );
    }
    
    // 3. Скачиваем фото из Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("docpix")
      .download(storagePath);
    
    if (downloadError || !fileData) {
      return NextResponse.json(
        { success: false, error: `Photo not found: ${downloadError?.message || "unknown error"}` },
        { status: 404 }
      );
    }
    
    const imageBuffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = imageBuffer.toString("base64");
    
    // 4. Запускаем OCR
    let ocrResult;
    try {
      ocrResult = await recognizeDocument(docType as DocKind, { base64 });
    } catch (err) {
      // OCR failed — cleanup и возвращаем ошибку
      console.error("[OCR] Failed:", err);
      
      // Удаляем фото из docpix (152-ФЗ compliance)
      await supabaseAdmin.storage.from("docpix").remove([storagePath]);
      
      return NextResponse.json({
        success: false,
        error: `OCR failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    
    // 5. Конвертируем ISO даты в DD.MM.YYYY
    const fields = { ...ocrResult.fields };
    const dateFields = ["birthDate", "passportIssuedDate", "licenseIssuedDate", "licenseValidUntil"];
    for (const field of dateFields) {
      if (fields[field as keyof typeof fields]) {
        (fields as any)[field] = isoToDmy(fields[field as keyof typeof fields] as string);
      }
    }
    
    // 6. Обновляем user_rental_secrets
    const { data: existingSecrets } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const secretData: Record<string, any> = {
      chat_id: chatId,
      source_rental_id: rentalId,
      [`${docType}_photo_path`]: storagePath,
    };
    
    if (docType === "passport") {
      secretData.renter_full_name = fields.fullName || null;
      secretData.renter_passport = fields.passportSeries && fields.passportNumber
        ? `${fields.passportSeries} ${fields.passportNumber}`
        : null;
      secretData.renter_passport_issue_date = fields.passportIssuedDate || null;
      secretData.renter_registration = fields.registrationAddress || null;
      secretData.renter_birth_date = fields.birthDate || null;
    } else {
      // license
      secretData.renter_driver_license = fields.licenseNumber || null;
      secretData.license_categories = fields.licenseCategories || null;
      secretData.license_expiry_date = fields.licenseValidUntil || null;
    }
    
    if (existingSecrets) {
      // Обновляем существующую запись
      await privateSchema()
        .from("user_rental_secrets")
        .update(secretData)
        .eq("id", existingSecrets.id);
    } else {
      // Создаем новую запись
      await privateSchema()
        .from("user_rental_secrets")
        .insert(secretData);
    }
    
    // 7. Обновляем rentals с photo path
    await supabaseAdmin
      .from("rentals")
      .update({ [`${docType}_photo_path`]: storagePath })
      .eq("rental_id", rentalId);
    
    // 8. Cleanup: удаляем фото из docpix (152-ФЗ compliance)
    await supabaseAdmin.storage.from("docpix").remove([storagePath]);
    
    // 9. Возвращаем успех
    return NextResponse.json({
      success: true,
      fields: fields as Record<string, string | null>,
    });
    
  } catch (error) {
    console.error("[OCR API] Unexpected error:", error);
    
    // Cleanup при любой ошибке
    if (storagePath) {
      try {
        await supabaseAdmin.storage.from("docpix").remove([storagePath]);
      } catch (cleanupError) {
        console.error("[OCR API] Cleanup failed:", cleanupError);
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
