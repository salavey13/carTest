import { logger } from "@/lib/logger";
import { fetchRepoTree } from "@/app/actions_github/actions";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { delay } from "@/lib/utils";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/salavey13/carTest";

function getFileCommentPrefix(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
        case 'sql': return '--';
        case 'py': case 'rb': case 'sh': case 'yml': case 'yaml': return '#';
        default: return '//';
    }
}

async function sendBatchedCode(chatId: number, content: string) {
    const MAX_LENGTH = 4096;
    const lang = 'typescript'; // A reasonable default for mixed content
    const header = `\`\`\`${lang}\n`;
    const footer = "\n\`\`\`";
    const overhead = header.length + footer.length;

    const lines = content.split('\n');
    const chunks: string[] = [];
    let currentChunk = "";

    await delay(350); // Initial delay

    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > MAX_LENGTH - overhead) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line + '\n';
        } else {
            currentChunk += line + '\n';
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const message = `${header}${chunk.trimEnd()}${footer}`;
        await sendComplexMessage(chatId, message, []);
        await delay(350);
    }
}

export async function fileCommand(chatId: number, userId: number, args: string[]) {
    logger.info(`[File Command] User ${userId} triggered /file with args: [${args.join(', ')}]`);
    
    if (args.length === 0) {
        await sendComplexMessage(chatId, "⚠️ Укажи ключевое слово для поиска файла. Например: `/file help` или `/file actions.ts`.", []);
        return;
    }

    await sendComplexMessage(chatId, `🔎 Ищу файлы по запросу: \`${args.join('`, `')}\`...`, []);

    try {
        const treeResult = await fetchRepoTree(REPO_URL);
        if (!treeResult.success || !treeResult.tree || !treeResult.owner || !treeResult.repo) {
            throw new Error(treeResult.error || "Не удалось получить дерево файлов.");
        }
        const { tree, owner, repo } = treeResult;

        // --- Single-file search logic ---
        const searchTerm = args.join(' ').toLowerCase();
        const foundFiles = tree.filter(item => item.type === 'blob' && item.path?.toLowerCase().includes(searchTerm)).slice(0, 8);
        
        if (foundFiles.length === 0) {
            await sendComplexMessage(chatId, `🤷‍♂️ Файлы по запросу \`${searchTerm}\` не найдены.`, [], { removeKeyboard: true });
            return;
        }

        if (foundFiles.length > 1) {
            const message = `🎯 Найдено несколько файлов. Уточни запрос, выбрав нужный с помощью клавиатуры:`;
            const buttons: KeyboardButton[][] = foundFiles.map(file => ([{ text: `/file ${file.path}` }]));
            await sendComplexMessage(chatId, message, buttons, { keyboardType: 'reply' });
            return;
        }
            
        const file = foundFiles[0];
        if (!file.path) { throw new Error("Найденный файл не имеет пути."); }
            
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`;
        await sendComplexMessage(chatId, `✅ Файл найден! Загружаю содержимое...\n\n\`${file.path}\`\n\n[Посмотреть на GitHub](${rawUrl})`, [], { removeKeyboard: true });

        const response = await fetch(rawUrl);
        if (!response.ok) { throw new Error(`Не удалось загрузить содержимое файла. Статус: ${response.status}`); }
        const content = await response.text(); // content is now defined here
            
        const prefix = getFileCommentPrefix(file.path);
        const pathComment = `${prefix} /${file.path}`.trim();
        const finalContent = content.trim().startsWith(pathComment) ? content : `${pathComment}\n\n${content}`;

        await sendBatchedCode(chatId, finalContent);
        
        const studioLink = `t.me/${process.env.BOT_USERNAME || 'oneSitePlsBot'}/app`;
        await sendComplexMessage(chatId, `Готово! Также можешь открыть [студию](${studioLink}) для полной картины.`, []);

    } catch (error) {
        logger.error("[File Command] Error processing /file command:", error);
        const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
        await sendComplexMessage(chatId, `🚨 Ошибка выполнения команды:\n\`${errorMessage}\``, [], { removeKeyboard: true });
    }
}