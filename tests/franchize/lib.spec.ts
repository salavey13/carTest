import { describe, expect, it } from 'vitest';

import { catalogCardVariantStyles, crewPaletteForSurface, floatingCartOverlayBackground } from '@/app/franchize/lib/theme';
import { resolveFranchizeTheme, resolvePaletteByMode } from '@/app/franchize/lib/theme-resolver';
import { isExternalHref, toCategoryId } from '@/app/franchize/lib/navigation';
import { getCatalogPropulsionSegment, isSameCatalogPropulsion } from '@/app/franchize/lib/catalog-propulsion';
import { DEFAULT_FRANCHIZE_THEME } from '@/lib/franchize-config';
import type { FranchizeTheme } from '@/app/franchize/actions';

const theme: FranchizeTheme = {
  mode: 'dark',
  palette: {
    bgBase: '#101113',
    bgCard: '#20242a',
    textPrimary: '#f8fafc',
    textSecondary: '#a1a1aa',
    borderSoft: '#3f3f46',
    accentMain: '#f97316',
    accentMainHover: '#ea580c',
  },
};

describe('franchize navigation helpers', () => {
  it('normalizes catalog category names into stable DOM ids', () => {
    expect(toCategoryId('Big Adventure Bikes')).toBe('category-big-adventure-bikes');
    expect(toCategoryId('  City   Rental  ')).toBe('category-city-rental');
  });

  it('detects only HTTP(S) links as external navigation targets', () => {
    expect(isExternalHref('https://example.com')).toBe(true);
    expect(isExternalHref('http://example.com')).toBe(true);
    expect(isExternalHref('/franchize/vip-bike')).toBe(false);
    expect(isExternalHref('tg://resolve?domain=oneBikePlsBot')).toBe(false);
  });
});


describe('franchize catalog propulsion helpers', () => {
  it('keeps electric and gas bikes in separate VS lanes', () => {
    const electricBike = {
      title: 'Y-VOLT Surge V',
      category: 'Electro-Enduro',
      rawSpecs: { type: 'Electric', power_kw: '15+', range_km: '120' },
    };
    const gasBike = {
      title: 'Kawasaki Ninja H2',
      category: 'Hypersport',
      rawSpecs: { engine_cc: 998, horsepower: 231, fuel_tank_l: 17 },
    };

    expect(getCatalogPropulsionSegment(electricBike)).toBe('electric');
    expect(getCatalogPropulsionSegment(gasBike)).toBe('gas');
    expect(isSameCatalogPropulsion(electricBike, gasBike)).toBe(false);
  });

  it('does not classify a gas bike as electric just because support text mentions a battery', () => {
    const gasBikeWithBatteryNote = {
      title: 'Yamaha MT-09 SP',
      description: 'Бензиновый нейкед, обслужена 12V battery перед выдачей.',
      rawSpecs: { engine_cc: 890, horsepower: 119 },
    };

    expect(getCatalogPropulsionSegment(gasBikeWithBatteryNote)).toBe('gas');
  });
});

describe('franchize theme helpers', () => {
  it('maps crew palette tokens to surface style objects', () => {
    expect(crewPaletteForSurface(theme)).toMatchObject({
      page: {
        backgroundColor: '#101113',
        color: '#f8fafc',
      },
      accentPill: {
        borderColor: '#f97316',
        color: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
      },
    });
  });

  it('cycles catalog card variants predictably', () => {
    expect(catalogCardVariantStyles(theme, 0)).toMatchObject({
      borderColor: 'rgba(63, 63, 70, 0.3)',
      backgroundColor: '#20242a',
    });
    expect(catalogCardVariantStyles(theme, 3)).toEqual(catalogCardVariantStyles(theme, 0));
    expect(catalogCardVariantStyles(theme, -1)).toEqual(catalogCardVariantStyles(theme, 1));
  });

  it('uses stronger cart overlay opacity in dark mode', () => {
    expect(floatingCartOverlayBackground(theme)).toBe('rgba(32, 36, 42, 0.94)');
    expect(floatingCartOverlayBackground({ ...theme, mode: 'light' })).toBe('rgba(32, 36, 42, 0.9)');
  });

  it('resolves nested light palette metadata safely', () => {
    expect(resolveFranchizeTheme({
      theme: {
        mode: 'pepperolli_light',
        palettes: {
          light: {
            bgBase: '#fff7ed',
            bgCard: '#ffffff',
            accentMain: '#ea580c',
          },
        },
      },
    })).toMatchObject({
      mode: 'pepperolli_light',
      palette: {
        bgBase: '#fff7ed',
        bgCard: '#ffffff',
        accentMain: '#ea580c',
        textPrimary: DEFAULT_FRANCHIZE_THEME.palette.textPrimary,
      },
    });
  });

  it('falls back to defaults when crew theme metadata is malformed', () => {
    expect(resolveFranchizeTheme({ theme: { mode: 42, palette: 'broken' } })).toEqual(DEFAULT_FRANCHIZE_THEME);
    expect(resolvePaletteByMode({ theme: { mode: null, palettes: ['broken'] } })).toEqual(DEFAULT_FRANCHIZE_THEME.palette);
  });
});

describe('franchize early theme hints', () => {
  it('returns the known vip-bike palette before page data fetches run', async () => {
    const { getEarlyFranchizeThemeHint } = await import('@/app/franchize/lib/early-theme-hints');

    expect(getEarlyFranchizeThemeHint('vip-bike')).toMatchObject({
      mode: 'vip_bike_dark',
      palette: {
        bgBase: '#0A0A0A',
        bgCard: '#1A1A1A',
        accentMain: '#FFD700',
        accentMainHover: '#FFC125',
        textPrimary: '#FFFAF0',
        textSecondary: '#D4AF37',
        borderSoft: '#2A2A2A',
      },
    });
  });

  it('lets unknown slug lookups fall back to the default theme contract', async () => {
    const { getEarlyFranchizeThemeHint } = await import('@/app/franchize/lib/early-theme-hints');

    expect(getEarlyFranchizeThemeHint('unknown-crew')).toEqual(DEFAULT_FRANCHIZE_THEME);
  });
});
