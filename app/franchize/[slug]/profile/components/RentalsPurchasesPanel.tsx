"use client";

// RentalsPurchasesPanel — «Аренды и покупки»: the user's own rentals from the
// activity digest + planned buy orders. Both columns SPA-navigate to details.

import { motion } from "framer-motion";
import { MapPin, ShoppingCart, ChevronRight } from "lucide-react";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import type { FranchizeActivityDigest } from "@/app/franchize/profile-actions";
import {
  EmptyState,
  itemVariants,
  rentalStatusLabel,
  isLiveRentalStatus,
  type CrewTokens,
  type SpaNavigate,
} from "./profile-shared";

export function RentalsPurchasesPanel({
  digest,
  slug,
  T,
  navigateSpa,
}: {
  digest: FranchizeActivityDigest | null;
  slug: string;
  T: CrewTokens;
  navigateSpa: SpaNavigate;
}) {
  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
          <ShoppingCart className="h-4 w-4" /> Аренды и покупки
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Rentals section */}
          <div>
            <p className="mb-2 text-xs font-semibold " style={{ color: T.textMuted }}>
              Мои аренды
            </p>
            {digest?.rentals && digest.rentals.length > 0 ? (
              <div className="space-y-2">
                {digest.rentals.slice(0, 5).map((r) => (
                  <div
                    key={r.rentalId}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateSpa(r.docLink)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateSpa(r.docLink);
                      }
                    }}
                    className="block rounded-xl border p-3 text-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={T.styles.card}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {r.vehicleImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.vehicleImage}
                            alt={r.vehicleLabel}
                            className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        )}
                        <div>
                          <span className="font-semibold" style={{ color: T.text }}>
                            {r.vehicleLabel}
                          </span>
                          {r.agreedStartDate && r.agreedEndDate && (
                            <p style={{ color: T.textMuted }} className="mt-0.5 text-[11px]">
                              {new Date(r.agreedStartDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                              {" → "}
                              {new Date(r.agreedEndDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                      </div>
                      {r.isTestRide ? (
                        <span style={T.styles.accentBadge} className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap">
                          Тест-драйв
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap"
                          style={{
                            ...T.styles.accentPill,
                            opacity: isLiveRentalStatus(r.status) ? 1 : 0.6,
                          }}
                        >
                          {rentalStatusLabel(r.status)}
                        </span>
                      )}
                    </div>
                    {r.status === "active" && (
                      <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2"
                        style={{ borderColor: T.borderSoft }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateSpa(`/franchize/${slug}?vehicle=${r.vehicleId}`);
                          }}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition hover:opacity-85"
                          style={T.styles.ctaPrimary}
                        >
                          Продлить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MapPin className="h-6 w-6" />}
                title="Нет активных аренд"
                description="Начните аренду, чтобы она появилась здесь"
                actionLabel="Каталог байков"
                actionHref={`/franchize/${slug}`}
              />
            )}
          </div>

          {/* Orders section */}
          <div>
            <p className="mb-2 text-xs font-semibold " style={{ color: T.textMuted }}>
              Планируемые покупки
            </p>
            {digest?.buyOrders && digest.buyOrders.length > 0 ? (
              <div className="space-y-2">
                {digest.buyOrders.slice(0, 3).map((o) => (
                  <div
                    key={o.orderId}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateSpa(o.docLink)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigateSpa(o.docLink);
                      }
                    }}
                    className="block cursor-pointer rounded-xl border p-3 text-sm transition hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: T.borderSoft }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs " style={{ color: T.accent }}>
                        #{o.orderId}
                      </span>
                      <ChevronRight className="h-3 w-3 " style={{ color: T.textMuted }} />
                    </div>
                    <div className="mt-1 text-xs " style={{ color: T.text }}>
                      {o.status} · {o.vehicleIds.slice(0, 2).join(", ")}
                      {o.vehicleIds.length > 2 && ` +${o.vehicleIds.length - 2}`}
                    </div>
                    {o.docFileName && (
                      <div className="mt-1 text-xs " style={{ color: T.textMuted }}>
                        📄 {o.docFileName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ShoppingCart className="h-6 w-6" />}
                title="Нет заказов"
                description="Оформите покупку, чтобы она появилась здесь"
                actionLabel="Каталог"
                actionHref={`/franchize/${slug}`}
              />
            )}
          </div>
        </div>
      </FranchizeOperatorPanel>
    </motion.div>
  );
}

