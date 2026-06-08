/**
 * GET /api/download-installer
 *
 * Serves installer MD files for download.
 * Usage: /api/download-installer?file=ZAI_DOCX_INSTALLER.md
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_FILES = new Set([
  "ZAI_DOCX_INSTALLER.md",
  "DOC_SKILL_FULL_INSTALLER.md",
]);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const file = searchParams.get("file");

  if (!file || !ALLOWED_FILES.has(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  try {
    // Read file from root
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), file);
    const content = await fs.readFile(filePath, "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  } catch (error) {
    console.error(`Failed to serve installer file ${file}:`, error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
