import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Public API route to serve documentation files and CSVs.
 *
 * Examples:
 * - /api/docs/TWENTY_VS_FRANCHIZE_COMPARISON_RU.md
 * - /api/docs/autoreply/vip-bike-rentals.csv
 * - /api/docs/autoreply/vip-bike-sale.csv
 * - /api/docs/autoreply/vip-bike-rent.csv
 *
 * Files will be accessible at production URLs like:
 * - https://rental.vip-bike.ru/api/docs/...
 *
 * For cleaner URLs (without /api/), rewrites in next.config.mjs
 * map /docs/* → /api/docs/*
 */

// Get project root from current file location
// In Next.js API routes, we need to traverse up from the API route directory
const getCurrentDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  // For ESM modules
  const __filename = fileURLToPath(import.meta.url);
  return dirname(__filename);
};

const getProjectRoot = () => {
  const currentDir = getCurrentDirname();
  // From app/api/docs/[[...path]] go up 4 levels to project root
  return join(currentDir, '..', '..', '..', '..');
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const projectRoot = getProjectRoot();
  const filePath = join(projectRoot, "docs", ...path);

  try {
    const file = await readFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase();

    // Set appropriate content type
    const contentType = ext === 'md' ? 'text/markdown; charset=utf-8'
                     : ext === 'csv' ? 'text/csv; charset=utf-8'
                     : ext === 'json' ? 'application/json; charset=utf-8'
                     : 'text/plain; charset=utf-8';

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*', // Allow CORS for external access
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "File not found", path: filePath },
      { status: 404 }
    );
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
