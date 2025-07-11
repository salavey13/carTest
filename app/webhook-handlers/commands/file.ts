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

    await delay(350); // Initial delay before the first chunk

    for (const line of lines) {
        // Check if adding the next line would exceed the character limit for a single message
        if (currentChunk.length + line.length + 1 > MAX_LENGTH - overhead) {
            // If the chunk is not empty, push it to the list and start a new one
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line + '\n';
        } else {
            currentChunk += line + '\n';
        }
    }
    // Add the last remaining chunk
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    // Send each chunk wrapped in its own code block for parse safety
    for (const chunk of chunks) {
        if (!chunk.trim()) continue; // Skip empty chunks
        const message = `${header}${chunk.trimEnd()}${footer}`;
        await sendComplexMessage(chatId, message, []);
        await delay(350); // Respect Telegram rate limits
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

        // --- Multi-file search logic ---
        let combinedContent = "";
        let foundPaths: string[] = [];
        let ambiguousTerms: string[] = [];
        let notFoundTerms: string[] = [];

        for (const term of args) {
            const found = tree.filter(item => item.type === 'blob' && item.path?.toLowerCase().includes(term.toLowerCase()));
            if (found.length === 1 && found[0].path) {
                const filePath = found[0].path;
                const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`);
                if (response.ok) {
                    const fileContent = await response.text();
                    const prefix = getFileCommentPrefix(filePath);
                    const pathComment = `${prefix} /${filePath}`.trim();
                    
                    const contentWithHeader = fileContent.trim().startsWith(pathComment) 
                        ? fileContent 
                        : `${pathComment}\n\n${content}`;
                    
                    if (combinedContent) {
                        combinedContent += `\`\`\`\n\n// --- END OF FILE: ${foundPaths[foundPaths.length - 1]} ---\n\n\`\`\``;
                    }
                    combinedContent += contentWithHeader;
                    foundPaths.push(filePath);
                }
            } else if (found.length > 1) {
                ambiguousTerms.push(term);
            } else {
                notFoundTerms.push(term);
            }
        }
        
        let warnings = [];
        if (ambiguousTerms.length > 0) warnings.push(`неоднозначный поиск для: \`${ambiguousTerms.join('`, `')}\``);
        if (notFoundTerms.length > 0) warnings.push(`не найдено для: \`${notFoundTerms.join('`, `')}\``);

        if (warnings.length > 0) {
            await sendComplexMessage(chatId, `⚠️ Пропущено: ${warnings.join('; ')}.`);
        }

        if (combinedContent) {
            await sendComplexMessage(chatId, `✅ Найдено ${foundPaths.length} файлов. Загружаю объединенный контекст...`, [], { removeKeyboard: true });
            await sendBatchedCode(chatId, combinedContent);
        } else if (args.length > 0 && warnings.length === args.length) {
            await sendComplexMessage(chatId, `🤷‍♂️ Ни один из запрошенных файлов не найден с уникальным совпадением.`, [], { removeKeyboard: true });
            return;
        }
        
        const studioLink = `t.me/${process.env.BOT_USERNAME || 'oneSitePlsBot'}/app`;
        await sendComplexMessage(chatId, `Готово! Также можешь открыть [студию](${studioLink}) для полной картины.`, []);

    } catch (error) {
        logger.error("[File Command] Error processing /file command:", error);
        const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
        await sendComplexMessage(chatId, `🚨 Ошибка выполнения команды:\n\`${errorMessage}\``, [], { removeKeyboard: true });
    }
}