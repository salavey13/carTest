using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Function
{
    // ═══════════════════════════════════════════════════════════════════════════
    // supafuncs-FIXED.cs — drop-in замена supafuncs.txt (2026-10-11, ревью 89-a)
    //
    // Что изменилось против исходника (детали в docs/avito-agent-supabase-codereview.md):
    //   FIX-1 (CRITICAL) ListFreeCars: фильтр type='bike' + is_test_result=false +
    //            скрытые из каталога (specs->>hidden) не предлагаются.
    //   FIX-2 (CRITICAL) Батч-запросы: 2 HTTP-запроса вместо ~2N (был N+1×2 —
    //            таймаут функции на 147 машинах).
    //   FIX-3 (HIGH)     Валидация окна: end>start, старт не в прошлом (±2ч), ≤30 суток.
    //   FIX-4 (HIGH)     Часовой пояс: наивное время = Москва (+03:00, AVITO_TZ_OFFSET_HOURS),
    //            инвариантная культура при форматировании (web-чекаут пишет MSK).
    //   FIX-5 (HIGH)     Повторная проверка доступности внутри CreateBooking (гонка сужена;
    //            полная атомарность — RPC try_create_avito_rental, SQL у owner).
    //   FIX-6 (MEDIUM)   Правила приложения из app/franchize/lib/rental-overlap.ts:
    //            requested_* → agreed_* фолбэк, «нет конца» = старт+24ч, льгота 30 мин,
    //            протухшие строки (конец+30мин в прошлом) не блокируют, блокирующие
    //            статусы = in.(pending,pending_confirmation,confirmed,active).
    //   FIX-7 (MEDIUM)   metadata {source:'avito-agent', avito_chat_id} — оператор видит
    //            источник заявки; interest_amount=0 при interest_paid; total_cost=оценка.
    //   FIX-8 (LOW)      CheckAvailability возвращает конфликтное окно (модель предложит
    //            клиенту «занят до …»), как nearest_booking в YDB-ветке.
    //
    // Публичные сигнатуры сохранены: funcs.txt менять не обязательно.
    // Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_CREW_ID (uuid экипажа),
    //      AVITO_TZ_OFFSET_HOURS (по умолчанию 3).
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Конфигурация Supabase (VIP Bikes) ───────────────────────────────────────
    public static class SupabaseConfig
    {
        public static string Url => Environment.GetEnvironmentVariable("SUPABASE_URL")
            ?? throw new Exception("SUPABASE_URL is not set!");

        public static string ServiceKey => Environment.GetEnvironmentVariable("SUPABASE_SERVICE_KEY")
            ?? throw new Exception("SUPABASE_SERVICE_KEY is not set!");

        // FIX-4: если модель прислала время без явного смещения — считаем московским.
        public static int TzOffsetHours
        {
            get
            {
                var raw = Environment.GetEnvironmentVariable("AVITO_TZ_OFFSET_HOURS");
                return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var h) ? h : 3;
            }
        }

        // FIX-2/3.1: экипаж по умолчанию (uuid) — для листинга и повторной проверки принадлежности.
        public static string? CrewId =>
            string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SUPABASE_CREW_ID"))
                ? null
                : Environment.GetEnvironmentVariable("SUPABASE_CREW_ID");
    }

    // ── Тонкий REST-клиент к PostgREST (Supabase) ───────────────────────────────
    public static class SupabaseClient
    {
        private static readonly HttpClient http = new(new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(2)
        })
        { Timeout = TimeSpan.FromSeconds(30) };

        private static HttpRequestMessage NewRequest(HttpMethod method, string path)
        {
            var request = new HttpRequestMessage(method, $"{SupabaseConfig.Url}/rest/v1/{path}");
            request.Headers.Add("apikey", SupabaseConfig.ServiceKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", SupabaseConfig.ServiceKey);
            return request;
        }

        public static async Task<JsonElement> GetAsync(string path)
        {
            using var request = NewRequest(HttpMethod.Get, path);
            using var response = await http.SendAsync(request);

            string body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                throw new Exception($"Supabase GET {path} failed: {response.StatusCode} {body}");

            return JsonDocument.Parse(body).RootElement;
        }

        public static async Task<JsonElement> PostAsync(string path, object payload, string prefer)
        {
            using var request = NewRequest(HttpMethod.Post, path);
            request.Headers.Add("Prefer", prefer);

            string json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            });
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");

            using var response = await http.SendAsync(request);
            string body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Supabase POST {path} failed: {response.StatusCode} {body}");

            return string.IsNullOrWhiteSpace(body)
                ? default
                : JsonDocument.Parse(body).RootElement;
        }
    }

    // ── Модели ───────────────────────────────────────────────────────────────
    public class SupabaseCar
    {
        [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
        [JsonPropertyName("make")] public string? Make { get; set; }
        [JsonPropertyName("model")] public string? Model { get; set; }
        [JsonPropertyName("daily_price")] public decimal? DailyPrice { get; set; }
        [JsonPropertyName("quantity")] public decimal Quantity { get; set; } = 1;
        [JsonPropertyName("owner_id")] public string? OwnerId { get; set; }
        [JsonPropertyName("crew_id")] public string? CrewId { get; set; }
        [JsonPropertyName("type")] public string? Type { get; set; }
    }

    // FIX-6/8: строка аренды ровно в тех полях, которые нужны правилам приложения.
    public class SupabaseRentalRow
    {
        [JsonPropertyName("vehicle_id")] public string? VehicleId { get; set; }
        [JsonPropertyName("status")] public string? Status { get; set; }
        [JsonPropertyName("requested_start_date")] public string? RequestedStart { get; set; }
        [JsonPropertyName("requested_end_date")] public string? RequestedEnd { get; set; }
        [JsonPropertyName("agreed_start_date")] public string? AgreedStart { get; set; }
        [JsonPropertyName("agreed_end_date")] public string? AgreedEnd { get; set; }
    }

    public class AvailabilityResult
    {
        public bool Available { get; set; }
        public int FreeUnits { get; set; }
        public SupabaseCar? Car { get; set; }

        // FIX-8: конфликтное окно (ISO, UTC) — чтобы модель могла сказать «занят до …».
        public string? ConflictStartUtc { get; set; }
        public string? ConflictEndUtc { get; set; }
    }

    // ── Основная логика бронирования через Supabase ─────────────────────────────
    public static class SupabaseBookingService
    {
        // FIX-6: блокирующие статусы — как в checkFranchizeCarsAvailability.
        private const string BlockingStatusFilter = "in.(pending,pending_confirmation,confirmed,active)";

        // FIX-6: льгота на возврат (RENTAL_BLOCK_GRACE_MS в приложении).
        private static readonly TimeSpan LateReturnGrace = TimeSpan.FromMinutes(30);

        // FIX-6: если у строки аренды нет конца — считаем «старт + 24ч» (как приложение).
        private static readonly TimeSpan MissingEndFallback = TimeSpan.FromHours(24);

        // FIX-3: границы разумного окна брони.
        private static readonly TimeSpan PastTolerance = TimeSpan.FromHours(2);
        private static readonly TimeSpan MaxDuration = TimeSpan.FromDays(30);

        // ── FIX-4: нормализация времени ─────────────────────────────────────────
        // Наивное время (Kind=Unspecified/Local) считаем московским (AVITO_TZ_OFFSET_HOURS),
        // UTC — оставляем как есть. Формат — инвариантной культурой.
        public static DateTime NormalizeToUtc(DateTime value)
        {
            var utc = value.Kind switch
            {
                DateTimeKind.Utc => value,
                DateTimeKind.Local => value.ToUniversalTime(),
                _ => new DateTimeOffset(value, TimeSpan.FromHours(SupabaseConfig.TzOffsetHours)).UtcDateTime,
            };
            return DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        }

        private static string IsoUtc(DateTime utc) =>
            utc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);

        private static DateTime? ParseStored(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
                return dto.UtcDateTime;
            return null;
        }

        // ── FIX-3: валидация запрашиваемого окна ────────────────────────────────
        private static void ValidateWindow(DateTime startUtc, DateTime endUtc)
        {
            if (endUtc <= startUtc)
                throw new ArgumentException("Проверь даты: конец аренды не может быть раньше или равен началу.");

            if (startUtc < DateTime.UtcNow - PastTolerance)
                throw new ArgumentException("Проверь даты: начало аренды в прошлом. Укажи будущую дату и время.");

            if (endUtc - startUtc > MaxDuration)
                throw new ArgumentException("Проверь даты: максимальный срок аренды — 30 дней.");
        }

        // ── FIX-6: «эффективное окно» строки аренды по правилам приложения ──────
        private static bool TryEffectiveWindow(SupabaseRentalRow row, out DateTime startUtc, out DateTime endUtc)
        {
            startUtc = ParseStored(row.RequestedStart) ?? ParseStored(row.AgreedStart) ?? DateTime.MinValue;
            endUtc = ParseStored(row.RequestedEnd) ?? ParseStored(row.AgreedEnd) ?? DateTime.MinValue;

            if (startUtc == DateTime.MinValue && endUtc == DateTime.MinValue) { return false; }
            if (endUtc == DateTime.MinValue) endUtc = startUtc + MissingEndFallback;
            if (startUtc == DateTime.MinValue) startUtc = endUtc - MissingEndFallback;
            return true;
        }

        // Строка блокирует окно? (логика rentalRowBlocksWindow из приложения)
        private static bool RowBlocksWindow(SupabaseRentalRow row, DateTime windowStartUtc, DateTime windowEndUtc, DateTime nowUtc)
        {
            if (!TryEffectiveWindow(row, out var startUtc, out var endUtc)) return false;

            var effectiveEnd = endUtc + LateReturnGrace;
            var overlaps = startUtc < windowEndUtc && effectiveEnd > windowStartUtc;
            var notOverYet = effectiveEnd > nowUtc; // FIX-6: протухшие не блокируют
            return overlaps && notOverYet;
        }

        private static string RentalSelect =>
            "vehicle_id,status,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date";

        // ── Аренды, открытые для списка машин (ОДИН запрос на все) ─────────────
        private static async Task<List<SupabaseRentalRow>> FetchOpenRentalsAsync(IEnumerable<string> vehicleIds)
        {
            var ids = string.Join(",", vehicleIds.Select(Uri.EscapeDataString));
            var json = await SupabaseClient.GetAsync(
                $"rentals?vehicle_id=in.({ids})&status={BlockingStatusFilter}&select={RentalSelect}");
            return json.EnumerateArray()
                .Select(el => JsonSerializer.Deserialize<SupabaseRentalRow>(el.GetRawText())!)
                .ToList();
        }

        // Подсчёт свободных единиц по правилам приложения (в памяти, без N+1).
        private static void ApplyAvailability(AvailabilityResult target, SupabaseCar car,
            IEnumerable<SupabaseRentalRow> openRentals, DateTime startUtc, DateTime endUtc, DateTime nowUtc)
        {
            var occupied = openRentals.Count(r =>
                r.VehicleId == car.Id && RowBlocksWindow(r, startUtc, endUtc, nowUtc));

            var free = (int)car.Quantity - occupied;
            target.Available = free > 0;
            target.FreeUnits = Math.Max(free, 0);
            target.Car = car;

            if (!target.Available)
            {
                var conflict = openRentals.FirstOrDefault(r =>
                    r.VehicleId == car.Id && RowBlocksWindow(r, startUtc, endUtc, nowUtc));
                if (conflict != null && TryEffectiveWindow(conflict, out var cs, out var ce))
                {
                    target.ConflictStartUtc = IsoUtc(cs);
                    target.ConflictEndUtc = IsoUtc(ce + LateReturnGrace);
                }
            }
        }

        // vehicleId — id конкретной модели байка в таблице cars (напр. "kawasaki-ex650k").
        public static async Task<AvailabilityResult> CheckAvailabilityAsync(
            string vehicleId, DateTime startDate, DateTime endDate)
        {
            var startUtc = NormalizeToUtc(startDate);   // FIX-4
            var endUtc = NormalizeToUtc(endUtc);        // FIX-4
            var nowUtc = DateTime.UtcNow;

            // FIX-3: валидация окна и на входе проверки доступности тоже.
            ValidateWindow(startUtc, endUtc);

            // 1) Сам байк (нужна quantity — сколько единиц этой модели всего).
            JsonElement carsJson = await SupabaseClient.GetAsync(
                $"cars?id=eq.{Uri.EscapeDataString(vehicleId)}&select=id,make,model,daily_price,quantity,owner_id,crew_id,type");

            if (carsJson.GetArrayLength() == 0)
                return new AvailabilityResult { Available = false, FreeUnits = 0, Car = null };

            var car = JsonSerializer.Deserialize<SupabaseCar>(carsJson[0].GetRawText())!;

            // 2) Открытые аренды этой машины (FIX-2: один запрос, разбор в памяти — FIX-6).
            var openRentals = await FetchOpenRentalsAsync(new[] { car.Id });

            var result = new AvailabilityResult();
            ApplyAvailability(result, car, openRentals, startUtc, endUtc, nowUtc);
            return result;
        }

        // Список байков со свободными единицами на период (когда moto_id не передан).
        // FIX-1: только type='bike'; is_test_result=false; скрытые из каталога — мимо.
        // FIX-2: 2 запроса всего (машины + открытые аренды) вместо ~2N.
        public static async Task<List<AvailabilityResult>> ListFreeCarsAsync(DateTime startDate, DateTime endDate)
        {
            var startUtc = NormalizeToUtc(startDate);   // FIX-4
            var endUtc = NormalizeToUtc(endUtc);        // FIX-4
            var nowUtc = DateTime.UtcNow;
            ValidateWindow(startUtc, endUtc);           // FIX-3: ранняя ошибка на мусорном окне

            string? crewId = SupabaseConfig.CrewId;
            string crewFilter = string.IsNullOrWhiteSpace(crewId)
                ? ""
                : $"&crew_id=eq.{Uri.EscapeDataString(crewId)}";

            // FIX-1: type=eq.bike + is_test_result=eq.false. Скрытые фильтруем в памяти
            // (specs — jsonb; проще отсеять после десериализации).
            JsonElement carsJson = await SupabaseClient.GetAsync(
                $"cars?select=id,make,model,daily_price,quantity,owner_id,crew_id,type,specs&" +
                $"type=eq.bike&is_test_result=eq.false{crewFilter}&order=daily_price.asc");

            var cars = carsJson.EnumerateArray()
                .Select(el =>
                {
                    var car = JsonSerializer.Deserialize<SupabaseCar>(el.GetRawText())!;
                    return (car, hidden: el.TryGetProperty("specs", out var specs)
                                      && specs.ValueKind == JsonValueKind.Object
                                      && specs.TryGetProperty("hidden", out var h)
                                      && h.ValueKind == JsonValueKind.True);
                })
                .Where(x => !x.hidden)
                .Select(x => x.car)
                .ToList();

            if (cars.Count == 0) return new List<AvailabilityResult>();

            // FIX-2: все открытые аренды по этим машинам — одним запросом.
            var openRentals = await FetchOpenRentalsAsync(cars.Select(c => c.Id));

            var results = new List<AvailabilityResult>();
            foreach (var car in cars)
            {
                var r = new AvailabilityResult();
                ApplyAvailability(r, car, openRentals, startUtc, endUtc, nowUtc);
                if (r.Available) results.Add(r);
            }
            return results;
        }

        // chatId — Avito author_id клиента (user_id = avito_{chatId}).
        public static async Task<string> CreateBookingAsync(
            string chatId,
            string vehicleId,
            DateTime startDate,
            DateTime endDate,
            string? deliveryAddress = null)
        {
            var startUtc = NormalizeToUtc(startDate);   // FIX-4
            var endUtc = NormalizeToUtc(endUtc);        // FIX-4
            ValidateWindow(startUtc, endUtc);           // FIX-3: end>start, не в прошлом, ≤30 суток

            // 1) Байк существует + owner/crew + цена для оценки.
            JsonElement carsJson = await SupabaseClient.GetAsync(
                $"cars?id=eq.{Uri.EscapeDataString(vehicleId)}&select=id,make,model,daily_price,quantity,owner_id,crew_id,type");

            if (carsJson.GetArrayLength() == 0)
                throw new Exception($"Car {vehicleId} not found in Supabase");

            var car = JsonSerializer.Deserialize<SupabaseCar>(carsJson[0].GetRawText())!;
            if (car.Type != "bike")
                throw new ArgumentException($"'{vehicleId}' — не мотоцикл (type={car.Type ?? "null"}), бронировать можно только байки.");

            // FIX-5: повторная проверка доступности прямо перед вставкой (гонка сужена;
            // полная атомарность — RPC try_create_avito_rental, SQL приложен отдельно).
            var openRentals = await FetchOpenRentalsAsync(new[] { car.Id });
            var probe = new AvailabilityResult();
            ApplyAvailability(probe, car, openRentals, startUtc, endUtc, DateTime.UtcNow);
            if (!probe.Available)
                throw new Exception(
                    $"Мото {car.Make} {car.Model} уже занят на выбранные даты" +
                    (probe.ConflictEndUtc != null ? $" (занят до {probe.ConflictEndUtc})." : "."));
            if (!string.IsNullOrWhiteSpace(SupabaseConfig.CrewId) &&
                !string.Equals(car.CrewId, SupabaseConfig.CrewId, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Этот байк из другого экипажа — на текущем канале Авито он не бронируется.");

            string userId = $"avito_{chatId}";

            // 2) Upsert клиента в users (user_id — text, так что avito_* валиден).
            await SupabaseClient.PostAsync(
                "users?on_conflict=user_id",
                new { user_id = userId, language_code = "ru" },
                prefer: "resolution=merge-duplicates,return=minimal"
            );

            // FIX-7: предварительная оценка стоимости (не обещание цены — оператор подтвердит).
            decimal? totalEstimate = null;
            if (car.DailyPrice is > 0)
            {
                var days = Math.Max(1, (int)Math.Ceiling((endUtc - startUtc).TotalHours / 24.0));
                totalEstimate = car.DailyPrice * days;
            }

            // 3) Создать бронь.
            var rentalPayload = new
            {
                user_id = userId,
                vehicle_id = vehicleId,
                owner_id = car.OwnerId,
                crew_id = car.CrewId,
                status = "pending_confirmation",
                payment_status = "interest_paid",
                interest_amount = 0m,          // FIX-7: не оставляем пустым при interest_paid
                total_cost = totalEstimate,    // FIX-7: оценка, если цена известна
                requested_start_date = IsoUtc(startUtc),
                requested_end_date = IsoUtc(endUtc),
                delivery_address = deliveryAddress,
                created_by_operator_chat_id = chatId,
                metadata = new                 // FIX-7: оператор видит источник
                {
                    source = "avito-agent",
                    avito_chat_id = chatId,
                    estimate_basis = car.DailyPrice is > 0 ? "daily_price_x_days" : "unknown",
                },
            };

            JsonElement inserted = await SupabaseClient.PostAsync(
                "rentals",
                rentalPayload,
                prefer: "return=representation"
            );

            return inserted[0].GetProperty("rental_id").GetString()!;
        }
    }
}
