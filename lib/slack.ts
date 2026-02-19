import { logger } from "@/lib/logger";

type SlackPostMessageResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
};

type SlackOAuthAccessResponse = {
  ok: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

export type SlackPostResult =
  | { ok: true; ts?: string; channel?: string }
  | { ok: false; reason: "not_configured" | "api_error"; error: string };

type SlackRuntimeToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type TelegramPhotoMeta = {
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
};

let runtimeToken: SlackRuntimeToken | null = null;

export function getSlackBridgeConfig() {
  return {
    staticBotToken: process.env.SLACK_BOT_TOKEN,
    defaultChannel: process.env.SLACK_CODEX_CHANNEL_ID,
    mention: process.env.SLACK_CODEX_MENTION || "@codex",
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    refreshToken: process.env.SLACK_REFRESH_TOKEN,
    incomingWebhookUrl: process.env.SLACK_INCOMING_WEBHOOK_URL,
  };
}

function getBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function isTokenNearExpiry(expiresAt?: number) {
  if (!expiresAt) return false;
  const refreshBufferMs = 2 * 60 * 1000;
  return Date.now() >= (expiresAt - refreshBufferMs);
}

async function refreshSlackAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<SlackRuntimeToken | null> {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth(params.clientId, params.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    }).toString(),
  });

  const data = (await response.json()) as SlackOAuthAccessResponse;
  if (!response.ok || !data.ok || !data.access_token) {
    logger.error("[Slack] Failed to refresh OAuth token", { status: response.status, data });
    return null;
  }

  const expiresAt = typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : undefined;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || params.refreshToken,
    expiresAt,
  };
}

export async function getSlackAccessToken(): Promise<string | null> {
  const { staticBotToken, clientId, clientSecret, refreshToken } = getSlackBridgeConfig();

  if (staticBotToken) return staticBotToken;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  if (runtimeToken && !isTokenNearExpiry(runtimeToken.expiresAt)) {
    return runtimeToken.accessToken;
  }

  const refreshed = await refreshSlackAccessToken({
    clientId,
    clientSecret,
    refreshToken: runtimeToken?.refreshToken || refreshToken,
  });

  if (!refreshed) {
    return null;
  }

  runtimeToken = refreshed;
  return runtimeToken.accessToken;
}

export async function postSlackMessage(params: {
  text: string;
  channel?: string;
  threadTs?: string;
  blocks?: Array<Record<string, unknown>>;
}): Promise<SlackPostResult> {
  const { defaultChannel, incomingWebhookUrl } = getSlackBridgeConfig();

  if (incomingWebhookUrl) {
    const payload: Record<string, unknown> = {
      text: params.text,
      mrkdwn: true,
      link_names: true,
    };
    if (params.threadTs) payload.thread_ts = params.threadTs;
    if (params.blocks?.length) payload.blocks = params.blocks;

    const response = await fetch(incomingWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const webhookResult = response.ok
      ? { ok: true, status: response.status }
      : { ok: false, status: response.status, error: (await response.text()) || `Webhook error (${response.status})` };

    if (!webhookResult.ok) {
      return {
        ok: false,
        reason: "api_error",
        error: webhookResult.error || "Incoming webhook failed",
      };
    }

    return { ok: true };
  }

  const channel = params.channel || defaultChannel;
  const token = await getSlackAccessToken();

  if (!token || !channel) {
    return {
      ok: false,
      reason: "not_configured",
      error: "Slack bridge is not configured (set SLACK_INCOMING_WEBHOOK_URL OR token/channel OR OAuth refresh config).",
    };
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text: params.text,
      mrkdwn: true,
      link_names: true,
      thread_ts: params.threadTs,
      blocks: params.blocks,
    }),
  });

  const data = (await response.json()) as SlackPostMessageResponse;

  if (!response.ok || !data.ok) {
    logger.error("[Slack] Failed to post message", { status: response.status, data });
    return {
      ok: false,
      reason: "api_error",
      error: data.error || `Slack API error (${response.status})`,
    };
  }

  return { ok: true, ts: data.ts, channel: data.channel };
}

async function fetchTelegramPhotoBuffer(fileId: string) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    return { ok: false as const, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const fileInfo = await fileInfoResponse.json();

  if (!fileInfoResponse.ok || !fileInfo?.ok || !fileInfo?.result?.file_path) {
    return { ok: false as const, error: fileInfo?.description || `Telegram getFile failed (${fileInfoResponse.status})` };
  }

  const filePath = fileInfo.result.file_path as string;
  const fileResponse = await fetch(`https://api.telegram.org/file/bot${telegramToken}/${filePath}`);
  if (!fileResponse.ok) {
    return { ok: false as const, error: `Telegram file download failed (${fileResponse.status})` };
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  const contentType = fileResponse.headers.get("content-type") || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : "jpg";
  const fileName = filePath.split("/").pop() || `telegram-photo-${Date.now()}.${extension}`;

  return {
    ok: true as const,
    bytes: Buffer.from(arrayBuffer),
    fileName,
  };
}


async function ensureStorageBucket(params: { supabaseUrl: string; serviceRoleKey: string; bucket: string }) {
  const createResponse = await fetch(`${params.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.serviceRoleKey}`,
      apikey: params.serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: params.bucket,
      name: params.bucket,
      public: true,
      file_size_limit: 20971520,
    }),
  });

  if (createResponse.ok || createResponse.status === 409) {
    return { ok: true as const };
  }

  const errorText = await createResponse.text();
  return {
    ok: false as const,
    error: errorText || `Bucket create failed (${createResponse.status})`,
  };
}

async function uploadTelegramPhotoToPublicStorage(params: { bytes: Buffer; fileName: string; dedupeKey?: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false as const, error: "Supabase storage is not configured" };
  }

  const configuredBucket = process.env.CYBERTUTOR_SCREENSHOT_BUCKET;
  const bucketCandidates = [configuredBucket, "carpix", "codex-callback-images"]
    .filter(Boolean)
    .filter((bucket, index, list) => list.indexOf(bucket) === index) as string[];

  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const dedupeKey = (params.dedupeKey || safeFileName).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const objectName = `telegram-photo-forward/${dedupeKey}-${safeFileName}`;

  for (const bucket of bucketCandidates) {
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(objectName)}`;

    let uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: params.bytes,
    });

    if (!uploadResponse.ok && uploadResponse.status === 404) {
      const create = await ensureStorageBucket({ supabaseUrl, serviceRoleKey, bucket });
      if (!create.ok) {
        logger.warn("[Slack] Failed to auto-create fallback bucket for Telegram photo forwarding", {
          bucket,
          error: create.error,
        });
      } else {
        uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/octet-stream",
            "x-upsert": "true",
          },
          body: params.bytes,
        });
      }
    }

    if (uploadResponse.ok) {
      return {
        ok: true as const,
        url: `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectName}`,
        bucket,
      };
    }

    const err = await uploadResponse.text();
    logger.warn("[Slack] Telegram photo storage fallback upload failed for bucket", {
      bucket,
      status: uploadResponse.status,
      error: err,
    });
  }

  return { ok: false as const, error: "Supabase storage upload failed for all fallback buckets" };
}

async function uploadPhotoToSlack(params: {
  channel: string;
  threadTs?: string;
  bytes: Buffer;
  fileName: string;
  title: string;
}) {
  const token = await getSlackAccessToken();
  if (!token) {
    return { ok: false as const, error: "Slack token is not configured for file upload" };
  }

  const form = new FormData();
  form.append("channels", params.channel);
  form.append("filename", params.fileName);
  form.append("title", params.title);
  if (params.threadTs) form.append("thread_ts", params.threadTs);
  form.append("file", new Blob([params.bytes]), params.fileName);

  const response = await fetch("https://slack.com/api/files.upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    return { ok: false as const, error: data?.error || `files.upload failed (${response.status})` };
  }

  return { ok: true as const };
}

export async function postCodexCommandToSlack(params: {
  telegramCommandText: string;
  telegramUserId: string;
  telegramUsername?: string;
  telegramChatId: string;
  telegramPhotos?: TelegramPhotoMeta[];
}) {
  const { mention } = getSlackBridgeConfig();

  const normalizedCommand = params.telegramCommandText.replace(/^\/codex(?:@[\w_]+)?\s*/i, "").trim();
  const codexPrompt = normalizedCommand.length > 0 ? `${mention} ${normalizedCommand}` : mention;
  const callbackHint = {
    telegramChatId: params.telegramChatId,
    telegramUserId: params.telegramUserId,
  };

  const photos = params.telegramPhotos || [];
  const originLine = `TG origin: @${params.telegramUsername || "unknown"} (user ${params.telegramUserId})`;
  const text = [
    codexPrompt,
    "",
    originLine,
    `TG chat id: ${params.telegramChatId}`,
    photos.length > 0 ? `TG photo count: ${photos.length}` : null,
    `Callback payload hint: ${JSON.stringify(callbackHint)}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3500);

  const messageResult = await postSlackMessage({ text });
  if (!messageResult.ok || photos.length === 0) {
    return {
      ...messageResult,
      photoForwarding: {
        attempted: photos.length,
        uploaded: 0,
        skippedReason: photos.length > 0 ? "message_not_sent" : undefined,
      },
    };
  }

  const { defaultChannel, incomingWebhookUrl } = getSlackBridgeConfig();
  const uploadChannel = messageResult.channel || defaultChannel;
  const token = await getSlackAccessToken();

  if (!uploadChannel || !token) {
    const skippedReason = !uploadChannel ? "missing_channel" : "missing_token";
    logger.warn("[Slack] Skipping image upload for /codex photo", {
      skippedReason,
      incomingWebhookMode: Boolean(incomingWebhookUrl),
    });
    return {
      ...messageResult,
      photoForwarding: {
        attempted: photos.length,
        uploaded: 0,
        skippedReason,
      },
    };
  }

  const uniquePhotosBySource = new Map<string, TelegramPhotoMeta>();
  for (const photo of photos) {
    const key = photo.file_unique_id || photo.file_id;
    const previous = uniquePhotosBySource.get(key);
    if (!previous || (photo.file_size || 0) > (previous.file_size || 0)) {
      uniquePhotosBySource.set(key, photo);
    }
  }
  const uniquePhotos = [...uniquePhotosBySource.values()];

  let uploaded = 0;
  const uploadErrors: string[] = [];

  for (const [index, photo] of uniquePhotos.entries()) {
    const telegramImage = await fetchTelegramPhotoBuffer(photo.file_id);
    if (!telegramImage.ok) {
      const error = `photo ${index + 1}: ${telegramImage.error}`;
      uploadErrors.push(error);
      logger.error("[Slack] Failed to download Telegram photo for /codex forwarding", error);
      continue;
    }

    const uploadResult = await uploadPhotoToSlack({
      channel: uploadChannel,
      threadTs: messageResult.ts,
      bytes: telegramImage.bytes,
      fileName: telegramImage.fileName,
      title: `tg-homework-${params.telegramChatId}-${index + 1}`,
    });

    if (!uploadResult.ok) {
      const missingScope = uploadResult.error?.includes("missing_scope");
      if (missingScope) {
        const storageResult = await uploadTelegramPhotoToPublicStorage({
          bytes: telegramImage.bytes,
          fileName: telegramImage.fileName,
          dedupeKey: photo.file_unique_id || photo.file_id,
        });

        if (storageResult.ok) {
          uploaded += 1;
          await postSlackMessage({
            text: `📎 TG photo ${index + 1}: ${storageResult.url}`,
            channel: uploadChannel,
            threadTs: messageResult.ts,
          });
          continue;
        }

        const storageError = `photo ${index + 1}: missing_scope + storage_fallback_failed (${storageResult.error})`;
        uploadErrors.push(storageError);
        logger.error("[Slack] Failed to upload Telegram photo fallback URL to Slack", storageError);
        continue;
      }

      const error = `photo ${index + 1}: ${uploadResult.error}`;
      uploadErrors.push(error);
      logger.error("[Slack] Failed to upload Telegram photo to Slack", error);
      continue;
    }

    uploaded += 1;
  }

  if (uploadErrors.length > 0) {
    await postSlackMessage({
      text: `⚠️ TG image forwarding: ${uploaded}/${uniquePhotos.length} uploaded. Issues: ${uploadErrors.join("; ")}`,
      channel: uploadChannel,
      threadTs: messageResult.ts,
    });
  }

  return {
    ...messageResult,
    photoForwarding: {
      attempted: uniquePhotos.length,
      uploaded,
      skippedReason: uploaded === 0 && uploadErrors.length > 0 ? "upload_failed" : undefined,
      uploadErrors,
      incomingWebhookMode: Boolean(incomingWebhookUrl),
    },
  };
}
