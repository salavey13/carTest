import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSlackBridgeConfig, postSlackMessage } from "@/lib/slack";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmin } from "@/app/actions";

type CallbackBody = {
  branch?: string;
  taskPath?: string;
  prUrl?: string;
  summary?: string;
  status?: "done" | "failed" | "in_progress" | string;
  telegramChatId?: string | number;
  telegramUserId?: string | number;
  slackChannelId?: string;
  slackThreadTs?: string;
  imageUrl?: string;
  images?: string[];
};

type DeliveryStatus = {
  target: string;
  ok: boolean;
  mode: "text" | "photo";
  sentImages?: number;
  error?: string;
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

function extractImageUrls(body: CallbackBody) {
  const all = [body.imageUrl, ...(body.images || [])].filter((value): value is string => Boolean(value?.trim()));
  return Array.from(new Set(all));
}

async function sendTelegramPhotoWithCaption(chatId: string | number, text: string, imageUrls: string[]): Promise<DeliveryStatus> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { target: String(chatId), ok: false, mode: "photo", sentImages: 0, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  let sentImages = 0;
  for (let index = 0; index < imageUrls.length; index += 1) {
    const imageUrl = imageUrls[index];
    const payload: Record<string, string> = {
      chat_id: String(chatId),
      photo: imageUrl,
      parse_mode: "Markdown",
      disable_web_page_preview: "true",
    };

    if (index === 0) {
      payload.caption = text;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return {
        target: String(chatId),
        ok: false,
        mode: "photo",
        sentImages,
        error: data?.description || `sendPhoto failed (${response.status})`,
      };
    }

    sentImages += 1;
  }

  return { target: String(chatId), ok: true, mode: "photo", sentImages };
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CallbackBody;
    const previewUrl = buildPreviewUrl(body.branch, body.taskPath);
    const imageUrls = extractImageUrls(body);

    const lines = [
      `*Codex update:* ${body.status || "done"}`,
      body.summary ? `*Summary:* ${body.summary}` : null,
      body.branch ? `*Branch:* \`${body.branch}\`` : null,
      previewUrl ? `*Preview:* ${previewUrl}` : null,
      body.prUrl ? `*PR:* ${body.prUrl}` : null,
    ].filter(Boolean) as string[];

    const message = lines.join("\n");
    const textForSlack = message.replace(/\*/g, "");
    const imageDelivery: {
      telegram: DeliveryStatus[];
      slack: DeliveryStatus | null;
    } = {
      telegram: [],
      slack: null,
    };

    const uniqueTelegramTargets = Array.from(
      new Set([body.telegramChatId, body.telegramUserId].filter(Boolean).map((value) => String(value))),
    );

    for (const target of uniqueTelegramTargets) {
      if (imageUrls.length > 0) {
        const photoResult = await sendTelegramPhotoWithCaption(target, message, imageUrls);
        imageDelivery.telegram.push(photoResult);
      } else {
        const textResult = await sendComplexMessage(target, message, [], { parseMode: "Markdown" });
        imageDelivery.telegram.push({
          target,
          ok: textResult.success,
          mode: "text",
          error: textResult.error,
        });
      }
    }

    const slackConfig = getSlackBridgeConfig();
    const canSendToSlack = Boolean(body.slackChannelId || body.slackThreadTs || slackConfig.incomingWebhookUrl || slackConfig.defaultChannel);

    if (canSendToSlack) {
      const slackText = imageUrls.length > 0
        ? `${textForSlack}\nImage: ${imageUrls[0]}`
        : textForSlack;

      const slackBlocks = imageUrls.length > 0 && !slackConfig.incomingWebhookUrl
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: textForSlack,
              },
            },
            ...imageUrls.map((url) => ({
              type: "image",
              image_url: url,
              alt_text: "Codex callback image",
            })),
          ]
        : undefined;

      const slackResult = await postSlackMessage({
        text: slackText,
        channel: body.slackChannelId,
        threadTs: body.slackThreadTs,
        blocks: slackBlocks,
      });

      imageDelivery.slack = {
        target: body.slackChannelId || slackConfig.defaultChannel || "incoming_webhook",
        ok: slackResult.ok,
        mode: imageUrls.length > 0 ? "photo" : "text",
        sentImages: imageUrls.length > 0 ? imageUrls.length : 0,
        error: slackResult.ok ? undefined : slackResult.error,
      };
    }

    const adminChatId = process.env.ADMIN_CHAT_ID;
    const wasAlreadyDeliveredToAdmin = Boolean(adminChatId && uniqueTelegramTargets.includes(String(adminChatId)));

    if (!wasAlreadyDeliveredToAdmin) {
      await notifyAdmin([
        "🤖 Codex bridge callback received",
        `Status: ${body.status || "done"}`,
        body.summary ? `Summary: ${body.summary}` : null,
        body.branch ? `Branch: ${body.branch}` : null,
        body.prUrl ? `PR: ${body.prUrl}` : null,
        body.telegramChatId ? `Chat: ${body.telegramChatId}` : null,
        body.telegramUserId ? `User: ${body.telegramUserId}` : null,
        previewUrl ? `Preview: ${previewUrl}` : null,
        imageUrls.length > 0 ? `Images: ${imageUrls.length}` : null,
      ].filter(Boolean).join("\n"));
    }

    return NextResponse.json({ ok: true, previewUrl, imageDelivery });
  } catch (error) {
    logger.error("[Codex Bridge Callback] error", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
