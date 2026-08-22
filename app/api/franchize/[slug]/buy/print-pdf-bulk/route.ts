// /app/api/franchize/[slug]/buy/print-pdf-bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateBuyPdf } from "@/app/franchize/server-actions/buy-print";
import { getFranchizeBySlug } from "@/app/franchize/server-actions/catalog";
import { logger } from "@/lib/logger";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Bulk PDF generation API for franchize sale bikes.
 * Generates PDF cards for multiple bikes and sends them to Telegram or saves to disk.
 *
 * Usage:
 *   POST /api/franchize/{slug}/buy/print-pdf-bulk
 *   Body: { slug, pageSize, bikeIds?, telegramChatId?, serviceRoleKey, saveToDisk?, outputDir? }
 *
 * - bikeIds: Optional comma-separated list of bike IDs (default: all with sale pricing)
 * - telegramChatId: Required for Telegram delivery (unless saveToDisk is true)
 * - pageSize: "A4" (default) or "A5"
 * - saveToDisk: If true, saves PDFs to disk instead of sending to Telegram (default: false)
 * - outputDir: Directory to save PDFs (default: "./tmp/bulk-pdfs")
 * - delayMs: Delay between PDFs in ms (default: 500)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug,
      bikeIds,
      pageSize,
      serviceRoleKey,
      telegramChatId,
      saveToDisk = false,
      outputDir = "./tmp/bulk-pdfs",
      delayMs = 500
    } = body;

    // Validate service role key for security
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!expectedKey || serviceRoleKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Missing slug" },
        { status: 400 }
      );
    }

    // If not saving to disk, telegramChatId is required
    if (!saveToDisk && !telegramChatId) {
      return NextResponse.json(
        { success: false, error: "Missing telegramChatId for PDF delivery (or use saveToDisk: true)" },
        { status: 400 }
      );
    }

    // Normalize page size
    const normalizedPageSize = pageSize === "A5" ? "A5" : "A4";

    // Parse bikeIds if provided
    const bikeIdArray = bikeIds
      ? String(bikeIds).split(",").map((id: string) => id.trim()).filter(Boolean)
      : [];

    // Fetch franchize data
    const { crew, items } = await getFranchizeBySlug(slug);

    // Filter sale bikes
    // Excludes test/internal bikes whose id starts with "vipbike"
    const saleBikes = items.filter((item) => {
      // Skip test/internal bikes
      if (item.id.startsWith("vipbike")) return false;
      const specs = item.rawSpecs || {};
      const hasSale = specs.sale === true || specs.sale === 1 || String(specs.sale).toLowerCase() === "true";
      return hasSale && item.title && (item.imageUrl || item.mediaUrls?.length);
    });

    // Further filter by bikeIds if provided
    const bikesToProcess = bikeIdArray.length > 0
      ? saleBikes.filter((bike) => bikeIdArray.includes(bike.id))
      : saleBikes;

    if (bikesToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: "No sale bikes found matching criteria" },
        { status: 404 }
      );
    }

    // Extract VK link from crew social links
    const vkLink = crew.footer?.socialLinks?.find(
      (link: any) => link.href && link.href.includes("vk.com")
    )?.href || "";

    // Get bot username for QR code generation
    const botUsername = crew.contacts.telegramBotUsername;

    // Forward telegram API (only needed if not saving to disk)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const forwardApiUrl = process.env.FORWARD_TELEGRAM_API || "https://v0-car-test.vercel.app/api/forward-telegram";

    // Create output directory if saving to disk
    let resolvedOutputDir = outputDir;
    if (saveToDisk) {
      resolvedOutputDir = join(process.cwd(), outputDir);
      if (!existsSync(resolvedOutputDir)) {
        await mkdir(resolvedOutputDir, { recursive: true });
      }
      logger.info(`[bulk-pdf] Saving PDFs to disk: ${resolvedOutputDir}`);
    }

    const results: Array<{ bikeId: string; fileName: string; filePath?: string; success: boolean }> = [];
    const skipped: Array<{ bikeId: string; reason: string }> = [];

    // Generate PDFs one by one with delay
    for (let i = 0; i < bikesToProcess.length; i++) {
      const bike = bikesToProcess[i];

      try {
        logger.info(`[bulk-pdf] Generating PDF ${i + 1}/${bikesToProcess.length} for bike ${bike.id}`);

        // Generate PDF bytes
        const bytes = await generateBuyPdf({
          slug,
          brandName: crew.header?.brandName || crew.name || "Экипаж",
          botUsername,
          vkLink,
          pageSize: normalizedPageSize,
          item: {
            id: bike.id,
            title: bike.title,
            description: bike.description || "",
            imageUrl: bike.imageUrl || "",
            salePrice: bike.salePrice,
            availabilityLabel: bike.availabilityLabel || "",
            rawSpecs: bike.rawSpecs,
          },
        });

        const fileName = `BUY_${normalizedPageSize}_${sanitizeFileName(bike.title)}_${bike.id}.pdf`;

        if (saveToDisk) {
          // Save to disk
          const filePath = join(resolvedOutputDir, fileName);
          await writeFile(filePath, Buffer.from(bytes));
          results.push({ bikeId: bike.id, fileName, filePath, success: true });
          logger.info(`[bulk-pdf] Saved PDF for bike ${bike.id} to ${filePath}`);
        } else {
          // Convert to base64 and send to Telegram
          const base64 = Buffer.from(bytes).toString("base64");

          // Send to Telegram via forward-telegram API
          const forwardResponse = await fetch(forwardApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramChatId,
              method: "sendDocument",
              payload: {
                caption: `${bike.title} - ${bike.salePrice ? bike.salePrice.toLocaleString("ru-RU") + " ₽" : "по запросу"}`,
              },
              files: {
                document: {
                  data: base64,
                  filename: fileName,
                  contentType: "application/pdf",
                },
              },
            }),
          });

          if (forwardResponse.ok) {
            results.push({ bikeId: bike.id, fileName, success: true });
            logger.info(`[bulk-pdf] Sent PDF for bike ${bike.id}`);
          } else {
            const errorText = await forwardResponse.text();
            skipped.push({ bikeId: bike.id, reason: `Telegram send failed: ${errorText}` });
            logger.warn(`[bulk-pdf] Failed to send PDF for bike ${bike.id}: ${errorText}`);
          }
        }

        // Delay between PDFs (except after the last one)
        if (i < bikesToProcess.length - 1 && delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown error";
        skipped.push({ bikeId: bike.id, reason });
        logger.error(`[bulk-pdf] Error processing bike ${bike.id}: ${reason}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: bikesToProcess.length,
      sent: results.length,
      savedToDisk: saveToDisk,
      outputDir: saveToDisk ? resolvedOutputDir : undefined,
      files: saveToDisk ? results.map(r => ({ fileName: r.fileName, filePath: r.filePath, bikeId: r.bikeId })) : undefined,
      skipped: skipped.length,
      skippedDetails: skipped,
    });
  } catch (error) {
    logger.error("[bulk-pdf] API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "bike";
}
