import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";
import { retryFranchizeOrderNotification } from "@/app/franchize/actions";
import { upsertFranchizeIntent } from "@/app/franchize/server-actions/intents";
import { ensureFranchizeOrderDocDelivery } from "./franchize-order-doc";

function formatMoney(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString("ru-RU")} ₽`;
}

function safeText(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export const franchizeOrderHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "franchize_order",
  handle: async (invoice, userId, userData, totalAmount, supabase, _telegramToken, adminChatId) => {
    const metadata = (invoice.metadata ?? {}) as Record<string, any>;
    const rentalId = typeof metadata.rental_id === "string" ? metadata.rental_id : undefined;
    const slug = typeof metadata.slug === "string" ? metadata.slug : "vip-bike";
    const orderId = typeof metadata.orderId === "string" ? metadata.orderId : undefined;

    if (!rentalId) {
      throw new Error(`franchize_order metadata missing rental_id for invoice ${invoice.id}`);
    }

    const firstItemId = metadata?.cartLines?.[0]?.itemId as string | undefined;
    if (!firstItemId) {
      throw new Error(`franchize_order metadata missing cart item for invoice ${invoice.id}`);
    }
    // Documented gap (boss R1 #8): the XTR path upserts ONE rental bound to
    // cartLines[0] — the cash/card path generates one rental per bike line
    // instead. Multi-bike XTR carts are structurally unsupported: the second
    // bike's money lands in total_cost with no rental row and its gear perks
    // never reach the salary engine. UI carts are single-bike in practice
    // (cart allows it, the invoice flow does not) — if that changes, spawn a
    // rental per line here.

    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars")
      .select("id, owner_id, make, model, image_url, specs")
      .eq("id", firstItemId)
      .maybeSingle();

    if (vehicleError) {
      throw new Error(`franchize_order vehicle fetch failed: ${vehicleError.message}`);
    }

    if (!vehicle?.owner_id) {
      throw new Error(`franchize_order owner not found for vehicle ${firstItemId}`);
    }

    await ensureFranchizeOrderDocDelivery({
      supabase,
      slug,
      orderId,
      retry: retryFranchizeOrderNotification,
    });

    const totalRub = Number(metadata.totalAmount || metadata.subtotal || 0);
    const interestStars = Number(metadata.amountXtr || totalAmount || 0);

    // iter25: derive the MOTO vs GEAR price split from the cart lines' price
    // breakdown (helmet + extras per line) and persist it on the rental row —
    // analytics, the CSV finance sheet and partner payouts then read the
    // EXACT charged amounts instead of re-estimating from quantities.
    const splitFromCart = (() => {
      const lines = Array.isArray(metadata.cartLines) ? metadata.cartLines : [];
      let gearRub = 0;
      let known = false;
      for (const line of lines) {
        const pb = line?.priceBreakdown;
        if (pb && (pb.helmetRub != null || pb.extrasRub != null)) {
          gearRub += Number(pb.helmetRub || 0) + Number(pb.extrasRub || 0);
          known = true;
        }
      }
      if (!known) return {};
      const equipmentPrice = Math.max(0, Math.round(gearRub));
      const bikePrice = Math.max(0, Math.round(totalRub - equipmentPrice));
      return { equipment_price: equipmentPrice, bike_price: bikePrice };
    })();

    // iter25: snapshot the partner-owner at deal time (partner bikes split
    // ~50/50; the snapshot survives later bike re-assignment).
    const subrenterSnapshot = (() => {
      const raw = (vehicle?.specs as Record<string, unknown> | null | undefined)?.["subrenter_chat_id"];
      if (typeof raw === "string" && raw.trim()) return { subrenter_chat_id: raw.trim() };
      if (typeof raw === "number" && Number.isFinite(raw)) return { subrenter_chat_id: String(raw) };
      return {};
    })();

    // ── 2026-09-28 (owner request: «think how to properly account rentals
    // created via web app flow regarding salary bonus … see doc-manual.ts
    // for bot doc creation flow as reference») ──
    // The XTR-invoice path upserted the rental with cart lines ONLY — the
    // metadata.equipment snapshot was missing, so
    // countEquipmentUnits() in the salary engine saw 0 units and the crew
    // member who ran the handover lost the 200₽/unit equipment bonus (the
    // cash/card path in actions-runtime.ts already wrote it — parity gap).
    // Same parser as actions-runtime (perk string → equipment map).
    const equipmentSnapshot = (() => {
      const perkStr = String(
        (metadata?.cartLines as Array<{ options?: { perk?: unknown } }> | undefined)?.[0]?.options?.perk || "",
      ).toLowerCase();
      if (!perkStr) return {};
      const m = perkStr.match(/шлем\s*[×x]\s*(\d+)/i);
      return {
        equipment: {
          helmets: m ? Number(m[1]) : (/шлем/.test(perkStr) ? 1 : 0),
          gloves: /перчатк/.test(perkStr) ? 1 : 0,
          jacket: /куртк/.test(perkStr),
          boots: /бот|сапог/.test(perkStr),
          net: /сетк/.test(perkStr),
          backpack: /рюкзак/.test(perkStr),
          bag: /сумк|багажн/.test(perkStr),
          charger: /зарядк/.test(perkStr),
        },
      };
    })();
    // doc-flow parity: seed the odometer hint from bike specs (the rental
    // page chain falls back to specs anyway, but the CSV/salary consumers
    // read the metadata keys).
    const specsRecord = (vehicle?.specs ?? null) as Record<string, unknown> | null;
    const specOdometerRaw = specsRecord?.last_known_odometer ?? specsRecord?.odometer;
    const specOdometer = Number(specOdometerRaw);
    const odometerHintSnapshot =
      Number.isFinite(specOdometer) && specOdometer >= 0
        ? { last_known_odometer: Math.round(specOdometer), odometer_before_hint: Math.round(specOdometer) }
        : {};

    await upsertFranchizeIntent({
      slug,
      bikeId: firstItemId,
      intentType: "rent",
      stage: "payment_confirmed",
      sourceRoute: `/franchize/${slug}/rental/${rentalId}`,
      contactChannel: "telegram_xtr",
      urgencyScore: 100,
      telegramUserId: userId,
      phone: typeof metadata.phone === "string" ? metadata.phone : undefined,
      metadata: {
        invoiceId: invoice.id,
        rentalId,
        orderId,
        flowType: metadata.flowType || "rental",
        totalAmount: Number(metadata.totalAmount || metadata.subtotal || 0),
        depositAmount: Number(metadata.depositAmount || metadata.reservationHold?.amountRub || 0),
        selectedDate: typeof metadata.rentalStartDate === "string" ? metadata.rentalStartDate : undefined,
        selectedEndDate: typeof metadata.rentalEndDate === "string" ? metadata.rentalEndDate : undefined,
        selectedTime: typeof metadata.time === "string" ? metadata.time : undefined,
        bikeIds: Array.isArray(metadata.cartLines) ? metadata.cartLines.map((line: any) => line?.itemId).filter(Boolean) : [firstItemId],
        invoiceStatus: "paid",
        hot: true,
        confirmed: true,
        interestStars,
      },
    });

    // ── 2026-09-28 (boss R1 #2): retry-safe upsert ──
    // Telegram re-delivers successful_payment at-least-once, and the admin
    // rental-tester can replay the invoice. A blind upsert REPLACED metadata
    // with the invoice snapshot — a late retry silently erased the renter's
    // odometer_before / odometer_after_draft / pickup_freeze written after
    // the first delivery. Fetch-first: when the row exists, the EXISTING
    // metadata wins (the invoice refreshes only the fields it owns) and the
    // post-creation side effects (todos + achievements) are skipped.
    const { data: existingRental } = await supabase
      .from("rentals")
      .select("rental_id, metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();
    const rentalAlreadyExisted = Boolean(existingRental);
    const existingRentalMetadata = (existingRental?.metadata ?? null) as Record<string, any> | null;

    const { error: upsertError } = await supabase.from("rentals").upsert(
      {
        rental_id: rentalId,
        user_id: userId,
        vehicle_id: vehicle.id,
        owner_id: vehicle.owner_id,
        status: "confirmed",
        payment_status: "interest_paid",
        interest_amount: interestStars,
        total_cost: totalRub,
        agreed_start_date: metadata?.rentalStartDate || new Date().toISOString(),
        agreed_end_date: metadata?.rentalEndDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        requested_start_date: metadata?.rentalStartDate || new Date().toISOString(),
        requested_end_date: metadata?.rentalEndDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        metadata: {
          ...(metadata || {}),
          ...splitFromCart,
          ...subrenterSnapshot,
          ...equipmentSnapshot,
          ...odometerHintSnapshot,
          // Retry: the live row's metadata (renter-set odometer, freeze,
          // closure data…) beats the stale invoice snapshot.
          ...(rentalAlreadyExisted && existingRentalMetadata ? existingRentalMetadata : {}),
          source: "franchize_order",
          franchise_slug: slug,
          hot_client: true,
          hold_confirmed_at: new Date().toISOString(),
          invoice_id: invoice.id,
        },
      },
      { onConflict: "rental_id" },
    );

    if (upsertError) {
      throw new Error(`franchize_order rental upsert failed: ${upsertError.message}`);
    }

    // ── 2026-09-28: non-fatal post-creation side effects for the XTR path ──
    // (1) dynamic crew_todos (verification + equipment return) — the cash
    //     checkout path spawns them in actions-runtime; without this the
    //     rental page degraded to a static checklist;
    // (2) renter self-service achievement «Сам себе оператор» (+ streaks,
    //     combo) — the web renter earns his own badges now.
    // Boss R1 #2: BOTH are skipped on a webhook retry (the row already
    // existed) — the todo creators are idempotent anyway, but the
    // achievement counter must not inflate per redelivery.
    if (!rentalAlreadyExisted) {
      try {
        const [{ data: crewRow }, { data: carRow }] = await Promise.all([
          supabase.from("crews").select("id").eq("slug", slug).maybeSingle(),
          supabase.from("cars").select("crew_id").eq("id", vehicle.id).maybeSingle(),
        ]);
        const crewUuid = crewRow?.id ?? carRow?.crew_id ?? null;
        if (crewUuid) {
          const [{ createRentalVerificationTodos }, { ensureRentalEquipmentReturnTodosForWebhook }] = await Promise.all([
            import("@/app/franchize/server-actions/rental-verification-todos"),
            import("@/app/franchize/server-actions/rentals"),
          ]);
          await Promise.allSettled([
            createRentalVerificationTodos(rentalId, crewUuid, userId),
            ensureRentalEquipmentReturnTodosForWebhook(rentalId, crewUuid),
          ]);
        } else {
          console.warn("[franchize-order] crew id not resolvable — todos skipped");
        }
      } catch (todoErr) {
        console.error("[franchize-order] todo spawn failed (non-fatal):", todoErr);
      }
      try {
        const { grantRenterWebRentCreated } = await import(
          "@/app/franchize/server-actions/renter-self-service-achievements"
        );
        const ach = await grantRenterWebRentCreated({ userId, slug, rentalId });
        if (ach.granted.length > 0) {
          console.log(`[franchize-order] renter achievements granted: ${ach.granted.join(", ")}`);
        }
      } catch (achErr) {
        console.error("[franchize-order] renter achievements failed (non-fatal):", achErr);
      }
    }

    const documentKey = `${metadata.flowType === "sale" || metadata.flowType === "mixed" ? "sale" : "rental"}-${slug}-${orderId || ""}`;
    const sourceScope = `${metadata.flowType || "rental"}:${slug}:${orderId || ""}`;
    const { data: verifierRow } = await supabase
      .from("doc_verifier_records")
      .select("id, original_sha256")
      .eq("document_key", documentKey)
      .eq("integration_scope", sourceScope)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: persistedRental } = await supabase
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();

    const rentalMetadata = (persistedRental?.metadata ?? {}) as Record<string, any>;
    await supabase
      .from("rentals")
      .update({
        metadata: {
          ...rentalMetadata,
          contract_verifier: {
            scope: `rental:${rentalId}`,
            sourceScope,
            documentKey,
            docVerifierRecordId: verifierRow?.id ?? null,
            originalSha256: verifierRow?.original_sha256 ?? null,
            status: verifierRow?.id ? "verified" : "not_verified",
            verifiedAt: verifierRow?.id ? new Date().toISOString() : null,
            expiresAt: null,
          },
        },
      })
      .eq("rental_id", rentalId);

    const startParam = typeof metadata.startParam === "string" && metadata.startParam.trim().length > 0
      ? metadata.startParam.trim()
      : `${metadata.flowType === "sale" || metadata.flowType === "mixed" ? "sale" : "rental"}-${rentalId}`;
    const tgDeepLink = `https://t.me/oneBikePlsBot/app?startapp=${startParam}`;
    const appLink = typeof metadata.franchizeRentalLink === "string" && metadata.franchizeRentalLink.trim().length > 0
      ? metadata.franchizeRentalLink.trim()
      : `https://v0-car-test.vercel.app/franchize/${slug}/rental/${rentalId}`;
    const catalogLink = `https://v0-car-test.vercel.app/franchize/${slug}`;

    const cartLines = Array.isArray(metadata.cartLines) ? metadata.cartLines : [];
    const extras = Array.isArray(metadata.extras) ? metadata.extras : [];
    const recipient = safeText(metadata.recipient);
    const phone = safeText(metadata.phone);
    const delivery = metadata.delivery === "delivery" ? "Доставка" : "Самовывоз";
    const slot = safeText(metadata.time);
    const comment = safeText(metadata.comment, "без комментария");
    const subtotalRub = Number(metadata.subtotal || 0);
    const extrasRub = Number(metadata.extrasTotal || 0);

    const cartText = cartLines.length
      ? cartLines
          .map((line: any) => {
            const title = safeText(line?.title || line?.itemId || "позиция");
            const qty = Number(line?.qty || 1);
            const pkg = safeText(line?.options?.package, "base");
            const duration = safeText(line?.options?.duration, "1d");
            const perk = safeText(line?.options?.perk, "none");
            return `• ${title} × ${qty} (${pkg}, ${duration}, ${perk})`;
          })
          .join("\n")
      : "• базовый пакет";

    const extrasText = extras.length
      ? extras.map((extra: any) => `• ${safeText(extra?.label)} (+${formatMoney(Number(extra?.amount ?? extra?.price ?? 0))})`).join("\n")
      : "• без допов";

    const userMessage = [
      "🎉 You are in! Сделка подтверждена и стартует по-настоящему.",
      "",
      `🏍 Техника: ${vehicle.make} ${vehicle.model}`,
      `🆔 Rental: ${rentalId}`,
      `👤 Получатель: ${recipient}`,
      `📞 Телефон: ${phone}`,
      `🧭 Формат: ${delivery}`,
      `⏱ Слот: ${slot}`,
      `📝 Комментарий: ${comment}`,
      "",
      "🧺 Состав:",
      cartText,
      "",
      "✨ Допы:",
      extrasText,
      "",
      `💸 Subtotal: ${formatMoney(subtotalRub)}`,
      `💸 Extras: ${formatMoney(extrasRub)}`,
      `💸 Итого: ${formatMoney(totalRub)}`,
      `⭐ Подтверждение: ${interestStars} XTR`,
      "",
      "Нажми основную кнопку и продолжай оформление 🚀",
    ].join("\n");

    await sendComplexMessage(
      userId,
      userMessage,
      [
        [{ text: "🚀 Продолжить оформление", url: appLink }],
        [{ text: "📲 Открыть в Telegram WebApp", url: tgDeepLink }],
        [{ text: "🏁 К каталогу", url: catalogLink }],
      ],
      { imageQuery: `${vehicle.make} ${vehicle.model} motorcycle premium` },
    );

    await sendComplexMessage(
      vehicle.owner_id,
      `🔥 Новый горячий лид по франшизе ${slug}: @${userData.username || userId} оплатил 1% подтверждения за ${vehicle.make} ${vehicle.model}.\n` +
        `Сделка ${rentalId} готова к подтверждению следующего шага.`,
      [[{ text: "Открыть сделку", url: tgDeepLink }]],
      {},
    );

    await sendComplexMessage(
      adminChatId,
      `📌 Franchize order confirmed\nslug: ${slug}\nrental: ${rentalId}\nuser: @${userData.username || userId}\nvehicle: ${vehicle.make} ${vehicle.model}\nsubtotal: ${formatMoney(subtotalRub)}\nextras: ${formatMoney(extrasRub)}\ntotal: ${formatMoney(totalRub)}\ninterest: ${interestStars} XTR`,
      [[{ text: "Open rental", url: appLink }]],
      {},
    );

    // ── 2026-09-24 (owner request «notify all members about new rents created
    // via web app and send to crew email as well»): the messages above cover
    // only the renter, the bike owner and the platform admin — this lib pings
    // every OTHER active crew member + drops a line to the crew mailbox
    // (private.crew_secrets.email → SMTP fallback). Sale-only orders are
    // skipped — there is no handover to prep for. Fire-and-forget: a missing
    // notification must never break the payment webhook (lib itself is
    // non-fatal too, belt and suspenders).
    if (metadata.flowType !== "sale") {
      try {
        const { notifyCrewOfNewWebAppRental } = await import(
          "@/app/franchize/lib/crew-rent-notify"
        );
        const crewNotify = await notifyCrewOfNewWebAppRental({
          slug,
          rentalId,
          bikeTitle: `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || "техника",
          renterLabel: userData?.username ? `@${userData.username}` : userId,
          renterPhone: typeof metadata.phone === "string" ? metadata.phone : null,
          startDate: typeof metadata.rentalStartDate === "string" ? metadata.rentalStartDate : null,
          endDate: typeof metadata.rentalEndDate === "string" ? metadata.rentalEndDate : null,
          totalRub,
          depositRub:
            Number(metadata.depositAmount || metadata.reservationHold?.amountRub || 0) || null,
          appLink,
          // Renter / bike owner / platform admin already got their messages
          // above — skip them here so nobody is double-pinged.
          excludeChatIds: [userId, vehicle.owner_id, adminChatId],
        });
        console.log(
          `[franchize-order] crew notify: tg=${crewNotify.notified.length} email=${crewNotify.emailedTo ?? "skipped"}`,
        );
      } catch (notifyErr) {
        console.error("[franchize-order] crew notify failed (non-fatal):", notifyErr);
      }
    }
  },
};
