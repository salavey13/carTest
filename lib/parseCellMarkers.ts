export function parseCellMarkers(raw: string) {
  let text = raw.trim();
  let bg: string | undefined;
  let textColor: string | undefined;

  const COLOR_MAP: Record<string, string> = {
    red: "#ef4444", "красный": "#ef4444", "красн": "#ef4444",
    green: "#22c55e", "зелёный": "#22c55e", "зеленый": "#22c55e", "зелен": "#22c55e",
    blue: "#3b82f6", "синий": "#3b82f6", "син": "#3b82f6",
    yellow: "#eab308", "желтый": "#eab308", "жёлтый": "#eab308",
    orange: "#f97316", "оранжевый": "#f97316",
    purple: "#a855f7", "фиолетовый": "#a855f7",
    emerald: "#10b981", "изумрудный": "#10b981",
    cyan: "#06b6d4", "голубой": "#06b6d4",
    amber: "#f59e0b", rose: "#f43f5e", sky: "#0ea5e9",
    white: "#ffffff", black: "#000000", gray: "#6b7280",
  };

  // Регулярка для поиска (bg-цвет) или (цвет)
  const matches = [...text.matchAll(/\((bg-|фон-)?([a-zа-яё#0-9-]+)\)/gi)];

  for (const m of matches) {
    const prefix = m[1] || "";
    let token = m[2].toLowerCase().replace(/ё/g, "е");
    const hex = COLOR_MAP[token] || (token.startsWith("#") ? token : undefined);

    if (hex) {
      if (prefix === "bg-" || prefix === "фон-") bg = hex;
      else textColor = hex;
    }
  }

  // Очистка текста от технических скобок
  const cleanText = text.replace(/\((bg-|фон-)?[a-zа-яё#0-9-]+\)\s*/gi, "").trim();
  return { text: cleanText, bg, textColor };
}