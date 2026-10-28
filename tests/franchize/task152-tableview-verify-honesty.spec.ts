// tests/franchize/task152-tableview-verify-honesty.spec.ts
//
// Task 152 — boss 2026-10-27: «when i click on "verify" i see success toast,
// status briefly changes to "verified", but then almost instantly changes
// back to "ожидает"». Two stacked defects fixed:
//
//   1. STALE READ: the CSV endpoint carried NO Cache-Control at all —
//      Telegram in-app WebViews served the pre-verify table after the silent
//      refetch, so even a LANDED verify looked reverted (and a full page
//      refresh showed old statuses). Fix: no-store on both CSV routes.
//   2. TAP DRIFT: after a successful verify the ✓ vanished from the row (and
//      ver-filtered rows reflowed), so the next tap at the same spot hit the
//      NEIGHBOR row — the DB even recorded a verify landing on the row BELOW
//      the one the boss was looking at (9d7582e5 at 16:04:59 while he stared
//      at f335428d). Fix: row context in the confirm dialog (дата · байк ·
//      цена), the ✓ stays visible-but-disabled for the session on
//      just-verified rows, and the post-refetch check keeps the tint + warns
//      honestly when the fresh CSV does not reflect the write yet.
//
//   FEATURE (same boss message): per-row «выслать сверку» 📨 in the
//   «Верификация» cell — send the verification REQUEST to operator + owner
//   (each confirms SEPARATELY via the TG ✅/⚠️ keyboard) without ever opening
//   the rental.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = (p: string) => readFileSync(join(root, p), "utf8");

describe("task152 · tableview verify honesty + send-request", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("confirm dialog shows WHICH row is about to be verified (дата · байк · цена)", () => {
    // the row context is extracted from the rendered row's data cells
    expect(modal).toContain("const quickCtx: QuickRowCtx = rowRentalId");
    expect(modal).toContain("date: (r[0] || \"\").trim(),");
    // task 156 moved Марка to data col 7 (Способ оплаты/Имя/Телефон split)
    expect(modal).toContain("bike: (r[7] || \"\").trim(),");
    expect(modal).toContain("price: (r[3] || \"\").trim(),");
    // and rendered into ALL confirm dialogs before the OK (task 152: quick-✓
    // + 📨; task157 re-baseline: the «Оператор (ЗП)» reassignment dialog
    // reuses the same WHICH-row pattern → 3)
    expect(modal).toContain("const rowLabel = quickRowLabel(ctx);");
    expect(modal.match(/rowLabel \? `\$\{rowLabel\}\\n\\n` : ""/g)?.length).toBe(3);
  });

  it("post-refetch honesty: a fresh CSV that lacks «подтверждено» keeps the tint + warns", () => {
    // the loader reports which expected ids did not turn verified yet
    expect(modal).toContain(
      "if (verificationToneOf(verLabelForId(parsed, id)) !== \"verified\") stuck.add(id);",
    );
    // the single-row path turns a non-empty set into an explicit warning
    expect(modal).toContain(
      "Подтверждение принято",
    );
    expect(modal).toContain("но таблица пока показывает старый статус");
    // the bulk path does the same for the whole batch
    expect(modal).toContain(
      "Подтверждения приняты, но таблица пока показывает старые статусы",
    );
    // the fresh-CSV label lookup walks the АРЕНДЫ block and stops at the
    // next block banner (never misreads ЭКИП/ПРОДАЖИ rows)
    expect(modal).toContain("function verLabelForId(rows: string[][], rentalId: string): string {");
    expect(modal).toContain('r.some((c) => (c || "").trim() === "Верификация")');
  });

  it("the ✓ never vanishes mid-session: stays visible but disabled once verified", () => {
    expect(modal).toContain("const verifiedThisSession = !!(rowRentalId && justVerified?.has(rowRentalId));");
    expect(modal).toContain("(verTone !== \"verified\" || verifiedThisSession);");
    expect(modal).toContain("disabled={verifyPending || verifiedThisSession}");
    expect(modal).toContain("\"Сверка подтверждена в этом сеансе\"");
  });

  it("per-row «выслать сверку» 📨: request DMs to operator + owner from the table", () => {
    // the resend action is wired with the same owner-gated identity params
    expect(modal).toContain("resendVerificationDmsAction({ slug, rentalId, ...verifyActorParams });");
    // the confirm dialog discloses the SEPARATE confirmation semantics
    expect(modal).toContain("Выслать сверку в Telegram?");
    expect(modal).toContain("подтвердят расчёт по отдельности");
    // its own in-flight bookkeeping (spinner), never blocking the ✓
    expect(modal).toContain("const [sendingIds, setSendingIds] = useState<Set<string>>(() => new Set());");
    expect(modal).toContain("disabled={sendPending || verifiedThisSession}");
    // honest delivery report (same wording as the rental-page card)
    expect(modal).toContain("\" + копия вам\"");
    // a freshly created row changes the cell label — silent refetch
    expect(modal).toContain("if (res.data.created) void loadTable({ silent: true });");
    // the cell renders the second button while the row is not verified yet
    expect(modal).toContain("const showSendRequest =");
    expect(modal).toContain("aria-label=\"Выслать сверку в Telegram\"");
    expect(modal).toContain("подтвердят расчёт по отдельности (✅ / ⚠️ в личке)");
  });

  it("bigger tap targets: the round buttons grew to 32px (h-8 w-8)", () => {
    // 28px (h-7) was below the 32px touch floor — off-by-one taps on phones
    expect(modal).toContain("inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border");
  });

  it("CSV endpoints never cache: no-store on both routes (stale-table root cause)", () => {
    for (const route of [
      "app/api/franchize/rentals-csv-export/route.ts",
      "app/api/franchize/sales-csv-export/route.ts",
    ]) {
      const r = src(route);
      expect(r).toContain("\"Cache-Control\": \"no-store, max-age=0, must-revalidate\",");
      expect(r).toContain("\"CDN-Cache-Control\": \"no-store\",");
      // every data response spreads the guard
      expect(r.match(/\.\.\.NO_STORE_HEADERS/g)?.length).toBe(
        route.includes("rentals") ? 2 : 1,
      );
    }
  });
});
