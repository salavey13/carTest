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
        case 'html': case 'xml': case 'vue': case 'svelte': return '<!--';
        case 'css': case 'scss': return '/*';
        default: return '//';
    }
}

function getFileCommentSuffix(prefix: string): string {
    if (prefix === '/*') return '*/';
    if (prefix === '<!--') return '-->';
    return '';
}

async function sendBatchedCode(chatId: number, content: string, path: string) {
    const MAX_LENGTH = 4096;
    const lang = path.split('.').pop() || 'txt';

    const prefix = getFileCommentPrefix(path);
    const suffix = getFileCommentSuffix(prefix);
    const pathComment = `${prefix} /${path} ${suffix}`.trim();

    let finalContent = content;
    if (!content.trim().startsWith(pathComment)) {
        finalContent = `${pathComment}\n${content}`;
    }

    const fullMessage = `\`\`\`${lang}\n${finalContent}\n\`\`\``;

    const chunks: string[] = [];
    for (let i = 0; i < fullMessage.length; i += MAX_LENGTH) {
        chunks.push(fullMessage.substring(i, i + MAX_LENGTH));
    }
    
    for (const chunk of chunks) {
        await sendComplexMessage(chatId, chunk, []);
        await delay(350); // Respect Telegram rate limits
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

        if (!treeResult.success || !treeResult.tree || !treeResult.owner || !treeResult.repo) {
            throw new Error(treeResult.error || "Не удалось получить дерево файлов из репозитория.");
        }

        const foundFiles = treeResult.tree
            .filter(item => item.type === 'blob' && item.path?.toLowerCase().includes(searchTerm))
            .slice(0, 8); // Limit to 8 results for readability

        if (foundFiles.length === 0) {
            await sendComplexMessage(chatId, `🤷‍♂️ Файлы по запросу \`${searchTerm}\` не найдены. Попробуй другое ключевое слово.`, []);
            return;
        }

        if (foundFiles.length > 1) {
            const message = `🎯 Найдено несколько файлов. Выбери нужный с помощью клавиатуры:`;
            const buttons: KeyboardButton[][] = foundFiles.map(file => ([{
                // The text on the button IS the command that will be sent back
                text: `/file ${file.path}` 
            }]));
            
            await sendComplexMessage(chatId, message, buttons, { keyboardType: 'reply' });
            return;
        }

        const file = foundFiles[0];
        if (!file.path) { throw new Error("Найденный файл не имеет пути."); }
        
        const { owner, repo } = treeResult;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`;

        await sendComplexMessage(chatId, `✅ Файл найден! Загружаю содержимое...\n\n\`${file.path}\`\n\n[Посмотреть на GitHub](${rawUrl})`, [], {removeKeyboard: true});

        const response = await fetch(rawUrl);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить содержимое файла. Статус: ${response.status}`);
        }
        const content = await response.text();
        
        await sendBatchedCode(chatId, content, file.path);
        
        const studioLink = `t.me/${process.env.BOT_USERNAME || 'oneSitePlsBot'}/app`;
        await sendComplexMessage(chatId, `Готово! Также можешь открыть [студию](${studioLink}) для полной картины.`, []);

    } catch (error) {
        logger.error("[File Command] Error processing /file command:", error);
        const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
        await sendComplexMessage(chatId, `🚨 Ошибка выполнения команды:\n\`${errorMessage}\``, [], {removeKeyboard: true});
    }
}