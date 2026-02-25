export function parseCellMarkers(raw: string) {
  let text = raw.trim();
  let bg: string | undefined;
  let textColor: string | undefined;

  const COLOR_MAP: Record<string, string> = {
    red: "#ef4444", green: "#22c55e", blue: "#3b82f6", yellow: "#eab308",
    amber: "#f59e0b", orange: "#f97316", pink: "#ec4899", purple: "#a855f7",
    cyan: "#06b6d4", lime: "#84cc16", emerald: "#10b981", teal: "#14b8a6",
    rose: "#f43f5e", violet: "#8b5cf6", indigo: "#6366f1", sky: "#0ea5e9",
    white: "#ffffff", black: "#000000", gray: "#6b7280",
  };

  const matches = [...text.matchAll(/\((bg-)?([a-z#0-9-]+)\)/gi)];

  for (const m of matches) {
    const prefix = m[1] || "";
    let token = m[2].toLowerCase();

    if (prefix === "bg-") {
      bg = COLOR_MAP[token] || (token.startsWith("#") ? token : undefined);
    } else {
      textColor = COLOR_MAP[token] || (token.startsWith("#") ? token : undefined);
    }
  }

  text = text.replace(/\((bg-)?[a-z#0-9-]+\)\s*/gi, "").trim();
  return { text, bg, textColor };
}