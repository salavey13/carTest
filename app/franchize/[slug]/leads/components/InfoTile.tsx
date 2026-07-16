"use client";

export function InfoTile({ label, value, T, fullWidth }: { label: string; value: string; T: any; fullWidth?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${fullWidth ? "col-span-full" : ""}`} style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>{label}</p>
      <p className="mt-0.5 text-xs font-semibold break-words" style={{ color: T.text }}>{value}</p>
    </div>
  );
}