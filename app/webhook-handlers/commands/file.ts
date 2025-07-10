import { logger } from "@/lib/logger";
import { fetchRepoTree } from "@/app/actions_github/actions";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { delay } from "@/lib/utils";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/salavey13/carTest";

async function sendBatchedCode(chatId: number, content: string, title: string) {
    const MAX_LENGTH = 4096;
    const lang = 'typescript'; // Defaulting to ts for mixed contexts
    const header = `\`\`\`${lang}\n`;
    const footer = "\n\`\`\`";
    const overhead = header.length + footer.length;

    const lines = content.split('\n');
    const chunks: string[] = [];
    let currentChunk = "";

    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > MAX_LENGTH - overhead) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += line + '\n';
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    await delay(350); // Delay before sending the first chunk

    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i];
        
        // Each chunk is sent as a complete, self-contained code block to protect from Markdown parsing
        let message = `${header}${chunk.trimEnd()}${footer}`;
        
        // Add the special double-backtick wrappers for the very first and very last messages
        if (i === 0) {
            message = `\`\`${message}`;
        }
        if (i === chunks.length - 1) {
            message = `${message}\n\`\``;
        }

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

        // --- BONUS: Multi-file search logic ---
        if (args.length > 1) {
            let combinedContent = "";
            let foundPaths: string[] = [];
            let notFound: string[] = [];

            for (const term of args) {
                const found = tree.filter(item => item.type === 'blob' && item.path?.toLowerCase().includes(term.toLowerCase()));
                if (found.length === 1 && found[0].path) {
                    const filePath = found[0].path;
                    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`);
                    if (response.ok) {
                        const content = await response.text();
                        combinedContent += `// /${filePath}\n\n${content}\n\n// --- END OF FILE: ${filePath} ---\n\n`;
                        foundPaths.push(filePath);
                    }
                } else {
                    notFound.push(term);
                }
            }

            if (notFound.length > 0) {
                await sendComplexMessage(chatId, `⚠️ Пропущено: \`${notFound.join('`, `')}\` (не найдено или найдено >1 совпадения).`);
            }

            if (combinedContent) {
                await sendComplexMessage(chatId, `✅ Найдено ${foundPaths.length} файлов. Загружаю объединенный контекст...`, [], { removeKeyboard: true });
                await sendBatchedCode(chatId, combinedContent, `Combined context for ${args.join(', ')}`);
            } else {
                await sendComplexMessage(chatId, `🤷‍♂️ Ни один из запрошенных файлов не найден с уникальным совпадением.`, [], { removeKeyboard: true });
                return;
            }

        } else {
            // --- Original single-file search logic ---
            const searchTerm = args[0].toLowerCase();
            const foundFiles = tree.filter(item => item.type === 'blob' && item.path?.toLowerCase().includes(searchTerm)).slice(0, 8);

            if (foundFiles.length === 0) {
                await sendComplexMessage(chatId, `🤷‍♂️ Файлы по запросу \`${searchTerm}\` не найдены.`, [], { removeKeyboard: true });
                return;
            }

            if (foundFiles.length > 1) {
                const message = `🎯 Найдено несколько файлов. Выбери нужный с помощью клавиатуры:`;
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
            const content = await response.text();
            await sendBatchedCode(chatId, content, file.path);
        }
        
        const studioLink = `t.me/${process.env.BOT_USERNAME || 'oneSitePlsBot'}/app`;
        await sendComplexMessage(chatId, `Готово! Также можешь открыть [студию](${studioLink}) для полной картины.`, []);

    } catch (error) {
        logger.error("[File Command] Error processing /file command:", error);
        const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
        await sendComplexMessage(chatId, `🚨 Ошибка выполнения команды:\n\`${errorMessage}\``, [], {removeKeyboard: true});
    }
}