import { sendTelegramMessage, sendTelegramDocument } from "@/app/actions";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { fetchRepoTree, fetchRepoContents } from "@/app/actions_github/actions";


const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/salavey13/carTest"; // Fallback URL
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB Limit (Telegram Doc Size)

const subcontexts = {
  "Core Application Logic": [
    "next.config.mjs",
    "package.json",
    "tailwind.config.ts",
    "tsconfig.json",
    "types/database.types",
    "app/layout.tsx",
    "components/layout/",
    "app/globals.css",
    "contexts/AppContext.tsx",
    "hooks/supabase.ts",
    "lib/auth.ts",
    "lib/logger.ts",
    "lib/debugLogger.ts",
  ],
  "Arbitrage": [
    "app/arbitrage-explained",
    "app/arbitrage-live-scanner",
    "app/arbitrage-notdummies",
    "app/arbitrage-test-agent",
    "components/arbitrage", 
    "app/elon", //contains "GodMode" features in subdirectories
        "app/elon/testbase",
  ],
  "Webhooks and Telegram Bot": [
    "app/api/telegramWebhook/route.ts",
    "app/webhook-handlers",
    "app/actions.ts",
    "telegram.d.ts",
  ],
  "CyberFitness (Gamification)": [
    "app/cyberfitness",
    "hooks/cyberFitnessSupabase.ts",
  ],
  "PDF/TO Doc Processing": [
    "app/topdf",
    "app/todoc",
  ],
  "Tutorials/Examples": ["app/tutorials"],
  "Vibe Content Renderer": [
    "components/VibeContentRenderer.tsx",
    "lib/iconNameMap.ts",
  ],
  "Lead Generation & CRM": [
      "app/leads",
    ],
};

async function fetchFilesForSubcontext(repoUrl: string, tree: any[], filesPaths: string[]): Promise<{ success: boolean; files?: any[]; error?: string }> {
    if (!repoUrl) return { success: false, error: "Repo URL is missing." };
    if (!tree) return { success: false, error: "Repo tree is missing." };
    
    try {
        const ownerRepo = repoUrl.replace("https://github.com/", "");
        const owner = ownerRepo.split('/')[0];
        const repo = ownerRepo.split('/')[1];
        if (!owner || !repo) return { success: false, error: "Could not parse owner/repo from repo URL." };

        const filteredFiles = tree.filter((item: any) => item.type === "blob" && filesPaths.some((path) => item.path?.includes(path)));
        const filteredFilePaths = filteredFiles.map((item: any) => item.path);

        const fileContentsPromises = filteredFiles.map(async (file: any) => {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`;
          try {
              const response = await fetch(rawUrl);
              if (!response.ok) { return { success: false, error: `Failed to fetch ${rawUrl}: ${response.statusText}` }; }
              const content = await response.text();
              return { path: file.path, content };
          } catch (e: any) {
              return { success: false, error: `Error fetching content for ${file.path}: ${e.message || e}` };
          }
        });

        const results = await Promise.all(fileContentsPromises);

        const filesWithContent = results
            .filter((r: any) => r?.content)
            .map((r: any) => ({ path: r.path, content: r.content }));
        return { success: true, files: filesWithContent };
    } catch (error: any) {
        return { success: false, error: error.message || "Unknown error" };
    }
}

export async function ctxCommand(chatId: number, userId: number) {
  logger.info(`[Ctx Command V2] User ${userId} triggered the /ctx command.`);

  if (!REPO_URL) {
    logger.error("[Ctx Command] REPO_URL is not defined in environment variables.");
    await sendTelegramMessage(
      "🚨 Ошибка: URL репозитория не настроен на сервере.",
      [],
      undefined,
      chatId.toString()
    );
    return;
  }

  try {
    await sendComplexMessage(
      chatId,
      "🤖 Выбери подконтексты для загрузки (можно несколько).",
      [],
      { removeKeyboard: true }
    );
    const treeResult = await fetchRepoTree(REPO_URL);

    if (!treeResult.success || !treeResult.tree) {
      throw new Error(treeResult.error || "Не удалось получить дерево файлов.");
    }
    const { tree } = treeResult;

    const buttons: KeyboardButton[][] = Object.keys(subcontexts).map((key) => [
      { text: key, callback_data: `ctx_${key}` },
    ]);
    await sendComplexMessage(
      chatId,
      "Доступные подконтексты:",
      buttons,
      { keyboardType: "reply" }
    );
  } catch (error) {
    logger.error("[Ctx Command] Error initializing /ctx command:", error);
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка.";
    await sendComplexMessage(
      chatId,
      `🚨 Провал операции. Не удалось собрать контекст.\nПричина: ${errorMessage}`,
      [],
      { removeKeyboard: true }
    );
  }
}

export async function handleCtxCallback(chatId: number, userId: number, data: string) {
  logger.info(`[Ctx Callback] User ${userId} selected context: ${data}`);
  const selectedContext = data.replace("ctx_", "");

  if (!subcontexts[selectedContext]) {
    await sendTelegramMessage(
      `⚠️ Неизвестный подконтекст: ${selectedContext}.`,
      [],
      undefined,
      chatId.toString()
    );
    return;
  }
  await sendComplexMessage(
    chatId,
    `⏳ Загружаю файлы для подконтекста: \`${selectedContext}\`...`,
    [],
    { removeKeyboard: true }
  );

  try {
    const treeResult = await fetchRepoTree(REPO_URL);

    if (!treeResult.success || !treeResult.tree) {
      throw new Error(treeResult.error || "Не удалось получить дерево файлов.");
    }

    const { tree } = treeResult;
    const filesPaths = subcontexts[selectedContext];

    const { success, files, error } = await fetchFilesForSubcontext(REPO_URL, tree, filesPaths);

    if (!success || !files) {
      throw new Error(error || "Не удалось извлечь файлы для подконтекста.");
    }

    if (files.length === 0) {
      await sendTelegramMessage(
        `🤷‍♂️ Не найдено файлов для подконтекста: \`${selectedContext}\`.`,
        [],
        undefined,
        chatId.toString()
      );
      return;
    }

    const combinedContent = files
      .map(
        (file: any) => `// File: ${file.path}\n\n${file.content}\n\n// --- END OF FILE: ${file.path} ---\n\n`
      )
      .join("");

    if (combinedContent.length > MAX_FILE_SIZE) {
      await sendTelegramMessage(
        `Файл слишком большой (${(combinedContent.length / (1024 * 1024)).toFixed(
          2
        )}MB). Выберите меньше подконтекстов.`,
        [],
        undefined,
        chatId.toString()
      );
      return;
    }

    const fileName = `VibeContext_${selectedContext}_${new Date()
      .toISOString()
      .split("T")[0]}.ts`;
    const sendDocResult = await sendTelegramDocument(
      String(chatId),
      combinedContent,
      fileName
    );

    if (!sendDocResult.success) {
      throw new Error(sendDocResult.error || "Не удалось отправить файл с контекстом.");
    }

    logger.info(`[Ctx Command] Sent subcontext ${selectedContext} to user ${userId}.`);
    await sendComplexMessage(
        chatId,
        `✅ Подконтекст \`${selectedContext}\` отправлен.`,
        [],
        { removeKeyboard: true }
      );

  } catch (e) {
    logger.error("[Ctx Command] Error fetching or sending subcontext:", e);
    const errorMessage = e instanceof Error ? e.message : "Неизвестная ошибка.";
    await sendComplexMessage(
      chatId,
      `🚨 Провал операции. Не удалось собрать подконтекст.\nПричина: ${errorMessage}`,
      [],
      { removeKeyboard: true }
    );
  }
}