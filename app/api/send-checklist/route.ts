import { NextResponse } from 'next/server';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chatId = body?.chatId ?? body?.chat_id ?? null;

    if (!chatId) {
      return NextResponse.json({ success: false, error: 'chatId missing' }, { status: 400 });
    }

    const checklist = [
      '*Чек-лист: 10 шагов для снижения штрафов на маркетплейсах*',
      '',
      '1. *Автоматизируй остатки* — синхронизация остатков в реальном времени (API).',
      '2. *Проверь логику возвратов* — выдели refunds и автоматизируй метки возврата.',
      '3. *Контроль сроков отгрузки* — SLA и мониторинг задержек по периодам.',
      '4. *Внедри чеклисты на линии упаковки* — скан-контроль и фото-фиксация критичных заказов.',
      '5. *Аналитика на 2 недели* — мониторинг refunds/late по скользящему окну.',
      '6. *Авто-оповещения* — если refunds > X или late > Y — мгновенное сообщение в чат.',
      '7. *Резервные остатки* — safety stock и автоматическое закрытие карточек при нехватке.',
      '8. *Обучение персонала* — 5-минутные инструкции + чек-листы в таске.',
      '9. *Проверка загрузок прайсов и SKU* — контроль дублей и неверных артикулов.',
      '10. *Ревью штрафов* — еженедельный разбор причин и план корректировок.',
      '',
      'Если хочешь — могу сгенерировать план действий и roadmap по приоритетам. Пиши @salavey13'
    ].join('\n');

    const res = await sendComplexMessage(chatId, checklist, [], {
      imageQuery: 'warehouse checklist',
      parseMode: 'Markdown',
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error || 'send failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (err) {
    console.error('send-checklist error', err);
    return NextResponse.json({ success: false, error: 'internal error' }, { status: 500 });
  }
}