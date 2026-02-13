import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { postSlackMessage } from "@/lib/slack";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

type CallbackBody = {
  branch?: string;
  taskPath?: string;
  prUrl?: string;
  summary?: string;
  status?: "done" | "failed" | "in_progress" | string;
  telegramChatId?: string | number;
  slackChannelId?: string;
  slackThreadTs?: string;
};

function normalizeBranchSlug(branch: string) {
  return branch.trim().replace(/\//g, "-").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function buildPreviewUrl(branch?: string, taskPath?: string) {
  if (!branch) return null;

  const domainSuffix = process.env.VERCEL_PREVIEW_DOMAIN_SUFFIX;
  const projectName = process.env.VERCEL_PROJECT_NAME || "v0-car-test";
  const branchSlug = normalizeBranchSlug(branch);

  if (!domainSuffix) return null;

  const normalizedSuffix = domainSuffix.startsWith(".") || domainSuffix.startsWith("-")
    ? domainSuffix
    : `.${domainSuffix}`;
  const base = `https://${projectName}-git-${branchSlug}${normalizedSuffix}`;
  if (!taskPath) return base;

  const normalizedPath = taskPath.startsWith("/") ? taskPath : `/${taskPath}`;
  return `${base}${normalizedPath}`;
}

function verifySecret(req: NextRequest) {
  const expected = process.env.CODEX_BRIDGE_CALLBACK_SECRET;
  if (!expected) return false;
  const got = req.headers.get("x-codex-bridge-secret");
  return got === expected;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CallbackBody;
    const previewUrl = buildPreviewUrl(body.branch, body.taskPath);

    const lines = [
      `*Codex update:* ${body.status || "done"}`,
      body.summary ? `*Summary:* ${body.summary}` : null,
      body.branch ? `*Branch:* \`${body.branch}\`` : null,
      previewUrl ? `*Preview:* ${previewUrl}` : null,
      body.prUrl ? `*PR:* ${body.prUrl}` : null,
    ].filter(Boolean) as string[];

    const message = lines.join("\n");

    if (body.telegramChatId) {
      await sendComplexMessage(body.telegramChatId, message, [], { parseMode: "Markdown" });
    }

    if (body.slackChannelId || body.slackThreadTs) {
      await postSlackMessage({
        text: message.replace(/\*/g, ""),
        channel: body.slackChannelId,
        threadTs: body.slackThreadTs,
      });
    }

    return NextResponse.json({ ok: true, previewUrl });
  } catch (error) {
    logger.error("[Codex Bridge Callback] error", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
