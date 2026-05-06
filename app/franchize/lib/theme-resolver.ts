import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import type { FranchizeTheme } from "@/lib/franchize-config";

type UnknownRecord = Record<string, unknown>;
type Palette = FranchizeTheme["palette"];
type ThemePaletteCandidate = Partial<Palette> & {
  light?: Partial<Palette>;
  dark?: Partial<Palette>;
};

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  let current: unknown = obj;

  for (const key of path) {
    if (!isRecord(current) || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }

  return current === null || current === undefined ? fallback : (current as T);
}

function readRecordPath(obj: unknown, path: string[]): UnknownRecord {
  const value = readPath<unknown>(obj, path, {});
  return isRecord(value) ? value : {};
}

function readStringPath(obj: unknown, path: string[], fallback: string): string {
  const value = readPath<unknown>(obj, path, fallback);
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readPaletteValue(source: unknown, key: keyof Palette): string {
  return readStringPath(source, [key], DEFAULT_FRANCHIZE_THEME.palette[key]);
}

export function resolvePaletteByMode(franchize: unknown): Palette {
  const mode = readStringPath(franchize, ["theme", "mode"], DEFAULT_FRANCHIZE_THEME.mode).toLowerCase();
  const paletteCandidate = readRecordPath(franchize, ["theme", "palette"]) as ThemePaletteCandidate;
  const palettesCandidate = readRecordPath(franchize, ["theme", "palettes"]) as ThemePaletteCandidate;

  const explicitFlatPalette = (
    typeof paletteCandidate.bgBase === "string" &&
    typeof paletteCandidate.bgCard === "string" &&
    typeof paletteCandidate.accentMain === "string"
  )
    ? paletteCandidate
    : {};

  const modeBucket = mode.includes("light") ? "light" : "dark";
  const nestedByMode = readRecordPath(paletteCandidate, [modeBucket]) as Partial<Palette>;
  const nestedFromPalettes = readRecordPath(palettesCandidate, [modeBucket]) as Partial<Palette>;

  const source = {
    ...explicitFlatPalette,
    ...nestedFromPalettes,
    ...nestedByMode,
  } as Partial<Palette>;

  return {
    bgBase: readPaletteValue(source, "bgBase"),
    bgCard: readPaletteValue(source, "bgCard"),
    accentMain: readPaletteValue(source, "accentMain"),
    accentMainHover: readPaletteValue(source, "accentMainHover"),
    textPrimary: readPaletteValue(source, "textPrimary"),
    textSecondary: readPaletteValue(source, "textSecondary"),
    borderSoft: readPaletteValue(source, "borderSoft"),
  };
}

export function resolveFranchizeTheme(franchize: unknown): FranchizeTheme {
  return {
    mode: readStringPath(franchize, ["theme", "mode"], DEFAULT_FRANCHIZE_THEME.mode),
    palette: resolvePaletteByMode(franchize),
  };
}
