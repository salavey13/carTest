import { logger } from "@/lib/logger";

type SlackPostMessageResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
};

type SlackIncomingWebhookResult = {
  ok: boolean;
  status?: number;
  error?: string;
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



async function postViaIncomingWebhook(params: {
  webhookUrl: string;
  text: string;
  threadTs?: string;
}): Promise<SlackIncomingWebhookResult> {
  const payload: Record<string, string> = { text: params.text };
  if (params.threadTs) payload.thread_ts = params.threadTs;

  const response = await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  const bodyText = await response.text();
  logger.error("[Slack] Incoming webhook failed", { status: response.status, bodyText });
  return { ok: false, status: response.status, error: bodyText || `Webhook error (${response.status})` };
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
}): Promise<SlackPostResult> {
  const { defaultChannel, incomingWebhookUrl } = getSlackBridgeConfig();

  if (incomingWebhookUrl) {
    const webhookResult = await postViaIncomingWebhook({
      webhookUrl: incomingWebhookUrl,
      text: params.text,
      threadTs: params.threadTs,
    });

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
      thread_ts: params.threadTs,
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

export async function postCodexCommandToSlack(params: {
  telegramCommandText: string;
  telegramUserId: string;
  telegramUsername?: string;
  telegramChatId: string;
}) {
  const { mention } = getSlackBridgeConfig();

  const normalizedCommand = params.telegramCommandText.replace(/^\/codex(?:@[\w_]+)?\s*/i, "").trim();
  const codexPrompt = normalizedCommand.length > 0 ? `${mention} ${normalizedCommand}` : mention;

  const text = [
    "🤖 *Forwarded from Telegram*",
    codexPrompt,
    `• tg_user: ${params.telegramUsername ? `@${params.telegramUsername}` : "(no username)"} (${params.telegramUserId})`,
    `• tg_chat: ${params.telegramChatId}`,
  ].join("\n");

  return postSlackMessage({ text });
}
