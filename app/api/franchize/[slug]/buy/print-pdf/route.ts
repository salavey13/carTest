// /app/api/franchize/[slug]/buy/print-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendFranchizeBuyPrintPdf } from "@/app/franchize/server-actions/buy-print";
import { getFranchizeBySlug } from "@/app/franchize/server-actions/catalog";
import { generateBuyPdf } from "@/app/franchize/server-actions/buy-print";
import { logger } from "@/lib/logger";

/**
 * API wrapper for buy-sheet PDF generation.
 * Allows external scripts to generate PDFs without Next.js context.
 *
 * Usage:
 *   POST /api/franchize/{slug}/buy/print-pdf
 *   Body: { slug, bikeId, pageSize, serviceRoleKey, returnBytes }
 *
 * - Without telegramChatId: Returns PDF bytes (for forwarding via forward-telegram API)
 * - With telegramChatId: Sends to Telegram directly (via server action)
 *
 * Authentication via service role key (for internal scripts only).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, bikeId, pageSize, serviceRoleKey, telegramChatId, returnBytes } = body;

    // Validate service role key for security
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!expectedKey || serviceRoleKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!slug || !bikeId) {
      return NextResponse.json(
        { success: false, error: "Missing slug or bikeId" },
        { status: 400 }
      );
    }

    // If returnBytes is true, generate PDF and return bytes (don't send to Telegram)
    if (returnBytes === true) {
      try {
        const { crew, items } = await getFranchizeBySlug(slug);
        const item = items.find((candidate) => candidate.id === bikeId);

        if (!item) {
          return NextResponse.json(
            { success: false, error: "Bike not found" },
            { status: 404 }
          );
        }

        // Extract VK link from crew social links
        const vkLink = crew.footer?.socialLinks?.find(
          (link: any) => link.href && link.href.includes("vk.com")
        )?.href || "";

        const bytes = await generateBuyPdf({
          slug,
          brandName: crew.header?.brandName || crew.name || "Экипаж",
          botUsername: crew.contacts.telegramBotUsername,
          vkLink,
          pageSize: pageSize || "A4",
          item: {
            id: item.id,
            title: item.title,
            description: item.description || "",
            imageUrl: item.imageUrl || "",
            salePrice: item.salePrice,
            availabilityLabel: item.availabilityLabel || "",
            rawSpecs: item.rawSpecs,
          },
        });

        // Return PDF bytes as base64
        const base64 = Buffer.from(bytes).toString("base64");
        const fileName = `BUY_${pageSize || "A4"}_${bikeId}.pdf`;

        return NextResponse.json({
          success: true,
          bytes: base64,
          fileName,
          mimeType: "application/pdf",
        });
      } catch (genError) {
        logger.error("[buy/print-pdf] PDF generation failed", genError);
        return NextResponse.json(
          {
            success: false,
            error: genError instanceof Error ? genError.message : "PDF generation failed",
          },
          { status: 500 }
        );
      }
    }

    // Original behavior: send to Telegram via server action
    const result = await sendFranchizeBuyPrintPdf({
      slug,
      bikeId,
      pageSize: pageSize || "A4",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[buy/print-pdf API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
