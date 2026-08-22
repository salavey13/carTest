import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { fetchLeadsForDashboard } from "@/app/leads/actions";
import type { LeadRow } from "@/app/leads/actions";

function formatLead(lead: LeadRow): string {
    const title = lead.client_name ? `${lead.client_name}` : (lead.project_description || 'Без названия').substring(0, 40) + '...';
    const budget = lead.budget_range ? ` | ${lead.budget_range}` : '';
    const link = lead.lead_url ? `\n[Перейти к лиду](${lead.lead_url})` : '';
    return `*${title}* (Статус: ${lead.status || 'new'})${budget}${link}`;
}

export async function leadsCommand(chatId: number, userId: number) {
    logger.info(`[Leads Command] User ${userId} triggered the /leads command.`);
    await sendTelegramMessage("📡 *Сетевой Дозор:* Запрашиваю сводку по самым горячим лидам...", [], undefined, chatId.toString());
    
    try {
        const { data: leads, error } = await fetchLeadsForDashboard(String(userId), 'new');

        if (error) {
            throw new Error(error);
        }

        if (!leads || leads.length === 0) {
            await sendTelegramMessage("📪 Входящие пусты. Новых горячих лидов не обнаружено.", [], undefined, chatId.toString());
            return;
        }

        const top5Leads = leads.slice(0, 5);
        const messageLines = top5Leads.map(lead => formatLead(lead));
        const finalMessage = "🔥 *Топ-5 Новых Лидов:*\n\n" + messageLines.join('\n\n');

        await sendTelegramMessage(finalMessage, [], undefined, chatId.toString(), undefined, "Markdown");

    } catch (error) {
        logger.error("[Leads Command] Error fetching leads:", error);
        await sendTelegramMessage("🚨 Ошибка получения сводки по лидам. ЦОД не отвечает.", [], undefined, chatId.toString());
    }
}