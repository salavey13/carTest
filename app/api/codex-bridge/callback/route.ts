import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSlackBridgeConfig, postSlackMessage } from "@/lib/slack";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmin } from "@/app/actions";

type CallbackBody = {
  branch: string;
  taskPath: string;
  prUrl: string;
  summary: string;
  status: "done" | "failed" | "in_progress" | "completed" | string;
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


function buildTelegramHomeworkDeepLink(taskPath?: string) {
  if (!taskPath) return null;
  const normalizedPath = taskPath.startsWith("/") ? taskPath.slice(1) : taskPath;
  if (!normalizedPath.startsWith("homework/solution/")) return null;
  return `https://t.me/oneBikePlsBot/app?startapp=${normalizedPath}`;
}

function buildProductionTaskUrl(taskPath?: string) {
  if (!taskPath) return null;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://v0-car-test.vercel.app";

  const normalizedBase = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  const normalizedPath = taskPath.startsWith("/") ? taskPath : `/${taskPath}`;
  return `${normalizedBase.replace(/\/$/, "")}${normalizedPath}`;
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
    const shouldSendAsDocument = /\.png($|\?)/i.test(imageUrl);
    const endpoint = shouldSendAsDocument ? "sendDocument" : "sendPhoto";
    const mediaField = shouldSendAsDocument ? "document" : "photo";

    const payload: Record<string, string> = {
      chat_id: String(chatId),
      [mediaField]: imageUrl,
      disable_web_page_preview: "true",
    };

    if (index === 0) {
      payload.caption = text;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return {
        target: String(chatId),
        ok: false,
        mode: shouldSendAsDocument ? "photo" : "photo",
        sentImages,
        error: data?.description || `${endpoint} failed (${response.status})`,
      };
    }

    sentImages += 1;
  }

  return { target: String(chatId), ok: true, mode: "photo", sentImages };
}

function validateReplyTargets(body: CallbackBody) {
  const errors: string[] = [];
  if (body.telegramChatId !== undefined && !/^-?\d+$/.test(String(body.telegramChatId))) {
    errors.push('telegramChatId must be numeric');
  }
  if (body.slackChannelId !== undefined && !/^[A-Z0-9]{8,15}$/.test(String(body.slackChannelId))) {
    errors.push('slackChannelId has invalid format');
  }
  if (body.slackThreadTs !== undefined && !/^\d{10}\.\d{6}$/.test(String(body.slackThreadTs))) {
    errors.push('slackThreadTs has invalid format');
  }
  return errors;
}

function validateRequired(body: Partial<CallbackBody>) {
  const errors: string[] = [];
  if (!body.status) errors.push('status is required');
  if (!body.summary) errors.push('summary is required');
  if (!body.branch) errors.push('branch is required');
  if (!body.taskPath || !String(body.taskPath).startsWith('/')) errors.push('taskPath is required and must start with /');
  if (!body.prUrl) {
    errors.push('prUrl is required');
  } else {
    try {
      const parsed = new URL(String(body.prUrl));
      if (!['http:', 'https:'].includes(parsed.protocol)) errors.push('prUrl must be http(s)');
    } catch {
      errors.push('prUrl must be a valid URL');
    }
  }
  return errors;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<CallbackBody>;
    const requiredErrors = validateRequired(body);
    const targetErrors = validateReplyTargets(body as CallbackBody);
    if (requiredErrors.length > 0 || targetErrors.length > 0) {
      return NextResponse.json({ ok: false, error: "Validation error", details: [...requiredErrors, ...targetErrors] }, { status: 400 });
    }
    const payload = body as CallbackBody;
    const previewUrl = buildPreviewUrl(payload.branch, payload.taskPath);
    const productionTaskUrl = buildProductionTaskUrl(payload.taskPath);
    const homeworkDeepLink = buildTelegramHomeworkDeepLink(payload.taskPath);
    const imageUrls = extractImageUrls(payload);

    const lines = [
      `Codex update: ${payload.status || "done"}`,
      payload.summary ? `Summary: ${payload.summary}` : null,
      payload.branch ? `Branch: ${payload.branch}` : null,
      productionTaskUrl ? `Result: ${productionTaskUrl}` : null,
      previewUrl ? `Preview: ${previewUrl}` : null,
      homeworkDeepLink ? `Open in bot app: ${homeworkDeepLink}` : null,
      payload.prUrl ? `PR: ${payload.prUrl}` : null,
    ].filter(Boolean) as string[];

    const message = lines.join("\n");
    const textForSlack = message;
    const imageDelivery: {
      telegram: DeliveryStatus[];
      slack: DeliveryStatus | null;
    } = {
      telegram: [],
      slack: null,
    };

    const uniqueTelegramTargets = Array.from(
      new Set([payload.telegramChatId, payload.telegramUserId].filter(Boolean).map((value) => String(value))),
    );

    for (const target of uniqueTelegramTargets) {
      if (imageUrls.length > 0) {
        const photoResult = await sendTelegramPhotoWithCaption(target, message, imageUrls);
        imageDelivery.telegram.push(photoResult);
      } else {
        const textResult = await sendComplexMessage(target, message, []);
        imageDelivery.telegram.push({
          target,
          ok: textResult.success,
          mode: "text",
          error: textResult.error,
        });
      }
    }

    const slackConfig = getSlackBridgeConfig();
    const canSendToSlack = Boolean(payload.slackChannelId || payload.slackThreadTs || slackConfig.incomingWebhookUrl || slackConfig.defaultChannel);

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
        channel: payload.slackChannelId,
        threadTs: payload.slackThreadTs,
        blocks: slackBlocks,
      });

      imageDelivery.slack = {
        target: payload.slackChannelId || slackConfig.defaultChannel || "incoming_webhook",
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
        `Status: ${payload.status || "done"}`,
        payload.summary ? `Summary: ${payload.summary}` : null,
        payload.branch ? `Branch: ${payload.branch}` : null,
        payload.prUrl ? `PR: ${payload.prUrl}` : null,
        payload.telegramChatId ? `Chat: ${payload.telegramChatId}` : null,
        payload.telegramUserId ? `User: ${payload.telegramUserId}` : null,
        previewUrl ? `Preview: ${previewUrl}` : null,
        imageUrls.length > 0 ? `Images: ${imageUrls.length}` : null,
      ].filter(Boolean).join("\n"));
    }

    return NextResponse.json({ ok: true, previewUrl, productionTaskUrl, homeworkDeepLink, imageDelivery });
  } catch (error) {
    logger.error("[Codex Bridge Callback] error", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
