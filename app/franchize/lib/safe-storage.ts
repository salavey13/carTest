// app/franchize/lib/safe-storage.ts — task166 (bonus, boss: «noticed on one
// dude's phone that highlighting … and item modal didn't open up … on other
// devices seems fine»): WebStorage ACCESS ITSELF throws SecurityError on
// phones that block cookies/site data (Android Chrome «Block cookies», some
// privacy WebViews, locked-down kiosks). One unguarded getItem inside a
// mount effect kills the whole React hydration for the page — the catalog
// renders its SSR HTML but NOTHING is interactive (no modal, no highlight,
// the startapp router never routes). Every storage touch on the catalog /
// hydration path now goes through these guarded wrappers.

type SafeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
};

function makeSafeStorage(getStore: () => Storage | null): SafeStorage {
  return {
    getItem(key: string): string | null {
      try {
        return getStore()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): boolean {
      try {
        getStore()?.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key: string): boolean {
      try {
        getStore()?.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

const browser = () => typeof window !== "undefined";

export const safeSessionStorage: SafeStorage = makeSafeStorage(() =>
  browser() ? window.sessionStorage : null,
);

export const safeLocalStorage: SafeStorage = makeSafeStorage(() =>
  browser() ? window.localStorage : null,
);
