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

  const modeBucket = mode.includes("light") ? "light" : "dark";
  const nestedFromPalettes = readRecordPath(palettesCandidate, [modeBucket]) as Partial<Palette>;
  const nestedByMode = readRecordPath(paletteCandidate, [modeBucket]) as Partial<Palette>;

  // Check if we have mode-specific palette in palettes.light or palettes.dark
  const hasModeSpecificPalette = (
    typeof nestedFromPalettes.bgBase === "string" &&
    typeof nestedFromPalettes.bgCard === "string" &&
    typeof nestedFromPalettes.accentMain === "string"
  );

  // Only use explicit flat palette if there are no mode-specific palettes
  // This prevents dark palette in theme.palette from overriding light palette in theme.palettes.light
  const explicitFlatPalette = hasModeSpecificPalette
    ? {}
    : (
        typeof paletteCandidate.bgBase === "string" &&
        typeof paletteCandidate.bgCard === "string" &&
        typeof paletteCandidate.accentMain === "string"
      )
      ? paletteCandidate
      : {};

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
  const mode = readStringPath(franchize, ["theme", "mode"], DEFAULT_FRANCHIZE_THEME.mode).toLowerCase();
  const isAutoMode = mode === "auto" || mode.includes("auto");
  const palette = resolvePaletteByMode(franchize);

  // Also extract palettes for client-side 'auto' mode switching
  const palettesCandidate = readRecordPath(franchize, ["theme", "palettes"]) as ThemePaletteCandidate;
  const lightPalette = readRecordPath(palettesCandidate, ["light"]) as Partial<Palette>;
  const darkPalette = readRecordPath(palettesCandidate, ["dark"]) as Partial<Palette>;

  const result = {
    mode,
    isAuto: isAutoMode,
    palette,
    palettes: {
      light: lightPalette.bgBase ? {
        bgBase: readPaletteValue(lightPalette, "bgBase"),
        bgCard: readPaletteValue(lightPalette, "bgCard"),
        accentMain: readPaletteValue(lightPalette, "accentMain"),
        accentMainHover: readPaletteValue(lightPalette, "accentMainHover"),
        textPrimary: readPaletteValue(lightPalette, "textPrimary"),
        textSecondary: readPaletteValue(lightPalette, "textSecondary"),
        borderSoft: readPaletteValue(lightPalette, "borderSoft"),
      } : undefined,
      dark: darkPalette.bgBase ? {
        bgBase: readPaletteValue(darkPalette, "bgBase"),
        bgCard: readPaletteValue(darkPalette, "bgCard"),
        accentMain: readPaletteValue(darkPalette, "accentMain"),
        accentMainHover: readPaletteValue(darkPalette, "accentMainHover"),
        textPrimary: readPaletteValue(darkPalette, "textPrimary"),
        textSecondary: readPaletteValue(darkPalette, "textSecondary"),
        borderSoft: readPaletteValue(darkPalette, "borderSoft"),
      } : undefined,
    },
  };

  // Check if the result matches the default theme (both mode and palette)
  // If so, return the default theme exactly (without extra isAuto/palettes properties)
  if (result.mode === DEFAULT_FRANCHIZE_THEME.mode &&
      result.palette.bgBase === DEFAULT_FRANCHIZE_THEME.palette.bgBase &&
      result.palette.bgCard === DEFAULT_FRANCHIZE_THEME.palette.bgCard &&
      result.palette.accentMain === DEFAULT_FRANCHIZE_THEME.palette.accentMain &&
      result.palette.accentMainHover === DEFAULT_FRANCHIZE_THEME.palette.accentMainHover &&
      result.palette.textPrimary === DEFAULT_FRANCHIZE_THEME.palette.textPrimary &&
      result.palette.textSecondary === DEFAULT_FRANCHIZE_THEME.palette.textSecondary &&
      result.palette.borderSoft === DEFAULT_FRANCHIZE_THEME.palette.borderSoft) {
    return DEFAULT_FRANCHIZE_THEME;
  }

  return result;
}
