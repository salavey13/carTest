/**
 * modules/digest/cli.ts — дедуп утреннего дайджеста.
 * Запуск: npx tsx modules/digest/cli.ts <command>
 *
 *   filter --file <candidates.json>   → печатает ТОЛЬКО новые элементы (и помечает их показанными)
 *                                        вход: JSON-массив [{ "title": "...", ... }]
 *   filter --file <f> --no-record     → отфильтровать без записи (предпросмотр)
 *   list-seen                         → показать уже показанные (для отладки)
 *   reset                             → очистить память дайджеста
 */
import fs from 'node:fs';
import { filterNew, listSeen, resetSeen, type Candidate } from './store.js';

function die(msg: string): never {
  console.error(`digest cli error: ${msg}`);
  process.exit(1);
}

const [, , command, ...rest] = process.argv;
const flags: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i++; } else { flags[key] = 'true'; }
  }
}

switch (command) {
  case 'filter': {
    if (!flags['file']) die('нужен --file <candidates.json>');
    let arr: Candidate[];
    try {
      arr = JSON.parse(fs.readFileSync(flags['file'], 'utf8')) as Candidate[];
    } catch (e) {
      die(`не прочитать JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(arr)) die('ожидался JSON-массив [{title,...}]');
    const fresh = filterNew(arr, { record: flags['no-record'] !== 'true' });
    process.stdout.write(
      JSON.stringify({ total: arr.length, new: fresh.length, items: fresh }, null, 2) + '\n',
    );
    break;
  }
  case 'list-seen':
    process.stdout.write(JSON.stringify(listSeen(), null, 2) + '\n');
    break;
  case 'reset':
    resetSeen();
    console.log('digest: память очищена');
    break;
  default:
    console.error(`Неизвестная команда: ${command ?? '(нет)'}. Доступны: filter | list-seen | reset`);
    process.exit(1);
}
