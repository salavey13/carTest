import { describe, expect, it } from 'vitest';

import { catalogCardVariantStyles, crewPaletteForSurface, floatingCartOverlayBackground } from '@/app/franchize/lib/theme';
import { isExternalHref, toCategoryId } from '@/app/franchize/lib/navigation';
import type { FranchizeTheme } from '@/app/franchize/actions';

const theme: FranchizeTheme = {
  mode: 'dark',
  radius: 'xl',
  palette: {
    bgBase: '#101113',
    bgCard: '#20242a',
    textPrimary: '#f8fafc',
    textSecondary: '#a1a1aa',
    borderSoft: '#3f3f46',
    accentMain: '#f97316',
    accentSecondary: '#fed7aa',
  },
};

describe('franchize navigation helpers', () => {
  it('normalizes catalog category names into stable DOM ids', () => {
    expect(toCategoryId('Big Adventure Bikes')).toBe('category-big-adventure-bikes');
    expect(toCategoryId('  City   Rental  ')).toBe('category--city-rental-');
  });

  it('detects only HTTP(S) links as external navigation targets', () => {
    expect(isExternalHref('https://example.com')).toBe(true);
    expect(isExternalHref('http://example.com')).toBe(true);
    expect(isExternalHref('/franchize/vip-bike')).toBe(false);
    expect(isExternalHref('tg://resolve?domain=oneBikePlsBot')).toBe(false);
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
});
