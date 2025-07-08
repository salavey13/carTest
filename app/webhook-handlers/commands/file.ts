import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { fetchRepoTree } from "@/app/actions_github/actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/salavey13/carTest";

async function sendBatchedCode(chatId: number, content: string, path: string) {
    const MAX_LENGTH = 4096;
    const codeBlockDelimiter = "```";
    const firstLine = `\`${path}\`\n\n`;

    // Split content by lines to avoid breaking code mid-line
    const lines = content.split('\n');
    let currentBatch = "";

    for (const line of lines) {
        if (currentBatch.length + line.length + codeBlockDelimiter.length * 2 + firstLine.length < MAX_LENGTH) {
            currentBatch += line + '\n';
        } else {
            // Send the previous batch and start a new one
            await sendComplexMessage(chatId, `${codeBlockDelimiter}typescript\n${currentBatch}${codeBlockDelimiter}`, []);
            currentBatch = line + '\n';
        }
    }
    
    // Send the last batch
    if (currentBatch) {
        await sendComplexMessage(chatId, `${firstLine}${codeBlockDelimiter}typescript\n${currentBatch}${codeBlockDelimiter}`, []);
    }
}


export async function fileCommand(chatId: number, userId: number, args: string[]) {
    logger.info(`[File Command] User ${userId} triggered /file with args: [${args.join(', ')}]`);
    
    if (args.length === 0) {
        await sendComplexMessage(chatId, "⚠️ Укажи ключевое слово для поиска файла. Например: `/file help` или `/file actions.ts`.", []);
        return;
    }

    const searchTerm = args.join(' ').toLowerCase();
    await sendComplexMessage(chatId, `🔎 Ищу файл по ключевому слову \`${searchTerm}\`...`, []);

    try {
        const treeResult = await fetchRepoTree(REPO_URL);

        if (!treeResult.success || !treeResult.tree) {
            throw new Error(treeResult.error || "Не удалось получить дерево файлов из репозитория.");
        }

        const foundFiles = treeResult.tree
            .filter(item => item.type === 'blob' && item.path?.toLowerCase().includes(searchTerm))
            .slice(0, 5); // Limit to 5 results to avoid spam

        if (foundFiles.length === 0) {
            await sendComplexMessage(chatId, `🤷‍♂️ Файлы по запросу \`${searchTerm}\` не найдены. Попробуй другое ключевое слово.`, []);
            return;
        }

        if (foundFiles.length > 1) {
            const fileList = foundFiles.map((file, index) => `${index + 1}. \`${file.path}\``).join('\n');
            await sendComplexMessage(chatId, `🎯 Найдено несколько файлов. Уточни запрос или выбери нужный:\n\n${fileList}`, []);
            return;
        }

        const file = foundFiles[0];
        const { owner, repo } = treeResult;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`;

        await sendComplexMessage(chatId, `✅ Файл найден! Загружаю содержимое...\n\n\`${file.path}\`\n\n[Raw](${rawUrl})`, []);

        const response = await fetch(rawUrl);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить содержимое файла. Статус: ${response.status}`);
        }
        const content = await response.text();
        
        await sendBatchedCode(chatId, content, file.path!);
        
        const studioLink = `t.me/${process.env.BOT_USERNAME || 'oneSitePlsBot'}/app`;
        await sendComplexMessage(chatId, `Готово! Также можешь открыть [студию](${studioLink}) для полной картины.`, []);

    } catch (error) {
        logger.error("[File Command] Error processing /file command:", error);
        const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
        await sendComplexMessage(chatId, `🚨 Ошибка выполнения команды:\n\`${errorMessage}\``, []);
    }
}