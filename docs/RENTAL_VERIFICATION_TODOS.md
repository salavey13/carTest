# Rental Verification Todos System

**Дата:** 2026-07-13  
**Статус:** ✅ Реализовано  
**Автор:** fk-pasha-admin

---

## Обзор

Система автоматического создания и завершения todos для верификации аренды. При создании аренды автоматически создаются 5 todos, которые помечаются как выполненные при верификации документов через `/api/verify-rental-checklist`.

---

## Архитектура

### 5 Verification Todos (создаются автоматически)

1. **Верифицировать паспорт (главная страница)** — `passport_mainpage`
2. **Верифицировать паспорт (страница с пропиской)** — `passport_registration`
3. **Верифицировать водительское удостоверение** — `drivers_license`
4. **Подтвердить начальный одометр** — `odometer`
5. **Подтвердить даты аренды** — `dates`

### Flow

```
1. User создаёт аренду через WebApp (OrderPageClient)
   ↓
2. actions-runtime.ts: buildFranchizeOrderDocAndNotify()
   ↓
3. Insert в rentals table
   ↓
4. createRentalVerificationTodos(rentalId, crewId)
   → Создаёт 5 todos в crew_todos (category='rental_verification')
   → rental_id хранится в description JSON
   ↓
5. Operator верифицирует документы через LEADS page
   ↓
6. POST /api/verify-rental-checklist
   { rentalId, updates: { passport_verified: true, ... } }
   ↓
7. Auto-complete todos:
   - passport_verified → completeRentalVerificationTodo(rentalId, "passport_mainpage")
                       → completeRentalVerificationTodo(rentalId, "passport_registration")
   - license_verified → completeRentalVerificationTodo(rentalId, "drivers_license")
   - odometer_before → completeRentalVerificationTodo(rentalId, "odometer")
   - dates_confirmed → completeRentalVerificationTodo(rentalId, "dates")
   ↓
8. UI показывает прогресс: 3/5 todos completed
```

---

## Server Actions

### `createRentalVerificationTodos(rentalId, crewId)`

Создаёт 5 verification todos для данной аренды.

**Параметры:**
- `rentalId: string` — ID аренды из `public.rentals`
- `crewId: string` — ID экипажа (default: `"2d5fde70-1dd3-4f0d-8d72-66ccf6908746"`)

**Возвращает:**
```typescript
{
  success: boolean;
  created: number; // количество созданных todos
  error?: string;
}
```

**Использование:**
```typescript
import { createRentalVerificationTodos } from "@/app/franchize/server-actions/rental-verification-todos";

const result = await createRentalVerificationTodos(rentalId, crewId);
if (result.success) {
  console.log(`Created ${result.created} verification todos`);
}
```

---

### `completeRentalVerificationTodo(rentalId, todoType)`

Помечает конкретный verification todo как выполненный.

**Параметры:**
- `rentalId: string` — ID аренды
- `todoType: RentalVerificationTodoType` — тип todo:
  - `"passport_mainpage"`
  - `"passport_registration"`
  - `"drivers_license"`
  - `"odometer"`
  - `"dates"`

**Возвращает:**
```typescript
{
  success: boolean;
  completed: boolean; // true если todo был найден и помечен как done
  error?: string;
}
```

**Использование:**
```typescript
import { completeRentalVerificationTodo } from "@/app/franchize/server-actions/rental-verification-todos";

await completeRentalVerificationTodo(rentalId, "passport_mainpage");
```

---

### `checkAllTodosCompleted(rentalId)`

Проверяет, все ли 5 verification todos выполнены.

**Параметры:**
- `rentalId: string` — ID аренды

**Возвращает:**
```typescript
{
  success: boolean;
  data?: {
    allCompleted: boolean; // true если все 5 todos done
    completedCount: number; // количество выполненных todos
    totalCount: number; // общее количество todos (обычно 5)
    todos: RentalVerificationTodo[]; // список всех todos с деталями
  };
  error?: string;
}
```

**Использование:**
```typescript
import { checkAllTodosCompleted } from "@/app/franchize/server-actions/rental-verification-todos";

const result = await checkAllTodosCompleted(rentalId);
if (result.success && result.data.allCompleted) {
  console.log("All verification steps completed!");
}
```

---

### `getRentalVerificationTodos(rentalId)`

Получает все verification todos для данной аренды (для UI).

**Параметры:**
- `rentalId: string` — ID аренды

**Возвращает:**
```typescript
{
  success: boolean;
  data?: RentalVerificationTodo[];
  error?: string;
}
```

**Использование:**
```typescript
import { getRentalVerificationTodos } from "@/app/franchize/server-actions/rental-verification-todos";

const result = await getRentalVerificationTodos(rentalId);
if (result.success) {
  for (const todo of result.data) {
    console.log(`${todo.title}: ${todo.status}`);
  }
}
```

---

## Database Schema

### Таблица: `public.crew_todos`

Todos хранятся в существующей таблице `crew_todos` с дополнительными полями:

```sql
{
  id: uuid,
  crew_id: uuid,
  title: text, -- "Верифицировать паспорт (главная страница)"
  description: jsonb, -- { rental_id, todo_type, source }
  category: text, -- "rental_verification"
  status: text, -- "pending" | "in_progress" | "done"
  priority: text, -- "low" | "medium" | "high"
  assigned_to: uuid | null,
  created_by: text, -- "system"
  created_at: timestamp,
  completed_at: timestamp | null
}
```

### Description JSON Structure

```json
{
  "rental_id": "uuid-of-rental",
  "todo_type": "passport_mainpage",
  "source": "rental_verification_system"
}
```

---

## Интеграция

### 1. Создание аренды (`actions-runtime.ts`)

**Файл:** `app/franchize/actions-runtime.ts`  
**Функция:** `buildFranchizeOrderDocAndNotify()`  
**Строки:** 2682-2695

```typescript
} else if (rentalRow?.rental_id) {
  logger.info("[franchize] Created rental row:", rentalRow.rental_id, "bike:", doc.bikeId);
  
  // Create verification todos for this rental
  try {
    const { createRentalVerificationTodos } = await import("@/app/franchize/server-actions/rental-verification-todos");
    const todosResult = await createRentalVerificationTodos(rentalRow.rental_id, crewId);
    if (todosResult.success) {
      logger.info(`[franchize] Created ${todosResult.created} verification todos for rental ${rentalRow.rental_id}`);
    } else {
      logger.warn(`[franchize] Failed to create verification todos for rental ${rentalRow.rental_id}:`, todosResult.error);
    }
  } catch (todoErr) {
    logger.warn("[franchize] Failed to create verification todos (non-fatal):", todoErr);
  }
}
```

---

### 2. Верификация документов (`verify-rental-checklist/route.ts`)

**Файл:** `app/api/verify-rental-checklist/route.ts`  
**Строки:** 206-234

```typescript
// 7. Auto-complete verification todos based on checklist updates
try {
  if (updates.passport_verified) {
    await completeRentalVerificationTodo(rentalId, "passport_mainpage");
    await completeRentalVerificationTodo(rentalId, "passport_registration");
    console.log(`[verify-rental-checklist] Auto-completed passport todos for rental ${rentalId}`);
  }

  if (updates.license_verified) {
    await completeRentalVerificationTodo(rentalId, "drivers_license");
    console.log(`[verify-rental-checklist] Auto-completed license todo for rental ${rentalId}`);
  }

  if (updates.odometer_before !== undefined && updates.odometer_before !== null) {
    await completeRentalVerificationTodo(rentalId, "odometer");
    console.log(`[verify-rental-checklist] Auto-completed odometer todo for rental ${rentalId}`);
  }

  if (updates.dates_confirmed) {
    await completeRentalVerificationTodo(rentalId, "dates");
    console.log(`[verify-rental-checklist] Auto-completed dates todo for rental ${rentalId}`);
  }
} catch (todoErr) {
  console.error("[verify-rental-checklist] Failed to auto-complete todos:", todoErr);
}
```

---

## UI Integration (для другого агента)

### Пример: Отображение todos на LEADS page

```tsx
import { getRentalVerificationTodos, checkAllTodosCompleted } from "@/app/franchize/server-actions/rental-verification-todos";

function RentalVerificationChecklist({ rentalId }: { rentalId: string }) {
  const [todos, setTodos] = useState<RentalVerificationTodo[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 5 });

  useEffect(() => {
    async function loadTodos() {
      const result = await getRentalVerificationTodos(rentalId);
      if (result.success && result.data) {
        setTodos(result.data);
        const completed = result.data.filter(t => t.status === "done").length;
        setProgress({ completed, total: result.data.length });
      }
    }
    loadTodos();
  }, [rentalId]);

  return (
    <div className="verification-checklist">
      <h3>Верификация аренды</h3>
      <div className="progress-bar">
        {progress.completed} / {progress.total} выполнено
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id} className={todo.status === "done" ? "completed" : "pending"}>
            {todo.status === "done" ? "✅" : "⏳"} {todo.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Testing

### Manual Test

1. Создай аренду через WebApp (OrderPageClient)
2. Проверь logs: `[franchize] Created 5 verification todos for rental <rental_id>`
3. Проверь Supabase:
   ```sql
   SELECT * FROM crew_todos 
   WHERE category = 'rental_verification' 
   AND description->>'rental_id' = '<rental_id>';
   ```
4. Верифицируй паспорт через LEADS page
5. Проверь logs: `[verify-rental-checklist] Auto-completed passport todos for rental <rental_id>`
6. Проверь Supabase: status должен быть `'done'` для passport todos

### API Test

```bash
# Создать аренду (через WebApp checkout)
# ...

# Проверить todos
curl -X POST https://rental.vip-bike.ru/api/verify-rental-checklist \
  -H "Content-Type: application/json" \
  -d '{
    "rentalId": "<rental_id>",
    "updates": {
      "passport_verified": true
    }
  }'

# Проверить прогресс (через server action)
# (нужен UI или прямой вызов из server component)
```

---

## Error Handling

### Non-Fatal Errors

Все ошибки в verification todos system являются **non-fatal**:
- Если создание todos не удалось → аренда всё равно создаётся
- Если auto-complete не сработал → верификация всё равно проходит
- Логируются все ошибки для debugging

### Common Issues

1. **Todos не создаются:**
   - Проверь logs: `[franchize] Failed to create verification todos`
   - Проверь, что `crew_todos` таблица существует
   - Проверь, что `category='rental_verification'` не конфликтует с RLS

2. **Todos не завершаются:**
   - Проверь logs: `[verify-rental-checklist] Failed to auto-complete todos`
   - Проверь, что `description` JSON содержит правильный `rental_id`
   - Проверь, что `todo_type` совпадает с одним из 5 типов

3. **UI не показывает todos:**
   - Проверь, что `getRentalVerificationTodos` вызывается с правильным `rentalId`
   - Проверь, что `category='rental_verification'` в query

---

## Future Enhancements

### Phase 2: Additional Todos

- [ ] **Фотофиксация состояния** (8-10 ракурсов при выдаче)
- [ ] **Подпись арендатора** (digital signature на акте приёма-передачи)
- [ ] **Оплата подтверждена** (payment_verified todo)
- [ ] **Инструктаж проведён** (safety briefing completed)

### Phase 3: Automated Completion

- [ ] **OCR auto-verification** — если OCR confidence > 95%, auto-complete passport todos
- [ ] **Payment webhook** — auto-complete payment todo при успешной оплате
- [ ] **QR scan** — auto-complete dates todo при сканировании QR кода

### Phase 4: Notifications

- [ ] **Telegram уведомления** — отправлять оператору список незавершённых todos
- [ ] **Email reminders** — если аренда начинается через 2 часа, а todos не завершены
- [ ] **Dashboard alerts** — показывать на analytics page rentals с незавершённой верификацией

---

## Related Files

- `app/franchize/server-actions/rental-verification-todos.ts` — server actions
- `app/franchize/actions-runtime.ts` — интеграция при создании аренды
- `app/api/verify-rental-checklist/route.ts` — auto-complete при верификации
- `app/franchize/server-actions/crew-todos.ts` — существующая todos система
- `app/franchize/server-actions/crew-todos-constants.ts` — типы и константы

---

## Commit

```
feat(todos): add rental verification todos system with auto-completion

- Create rental-verification-todos.ts with 4 server actions
- Integrate with actions-runtime.ts (auto-create after rental insert)
- Integrate with verify-rental-checklist API (auto-complete on verification)
- Todos stored in crew_todos with category='rental_verification'
- Non-fatal error handling
```

**Commit hash:** `382f5643`  
**Date:** 2026-07-13

---

**Готово!** Система verification todos реализована и задеплоена на Vercel. VPS не требуется (только client-side интеграция).
