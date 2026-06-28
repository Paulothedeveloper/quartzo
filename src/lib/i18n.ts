import { derived, get, writable } from "svelte/store";
import { dict } from "./i18n-dict";

export type Locale = "pt" | "en" | "es" | "fr" | "de";

export const LOCALES: { id: Locale; label: string; flag: string }[] = [
  { id: "pt", label: "Português", flag: "🇧🇷" },
  { id: "en", label: "English", flag: "🇺🇸" },
  { id: "es", label: "Español", flag: "🇪🇸" },
  { id: "fr", label: "Français", flag: "🇫🇷" },
  { id: "de", label: "Deutsch", flag: "🇩🇪" },
];

const KEY = "quartzo:locale";

function detect(): Locale {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(KEY);
    if (saved === "pt" || saved === "en" || saved === "es" || saved === "fr" || saved === "de") return saved;
  }
  if (typeof navigator !== "undefined") {
    const n = (navigator.language || "").toLowerCase();
    if (n.startsWith("pt")) return "pt";
    if (n.startsWith("es")) return "es";
    if (n.startsWith("fr")) return "fr";
    if (n.startsWith("de")) return "de";
    if (n.startsWith("en")) return "en";
  }
  return "pt";
}

export const locale = writable<Locale>(detect());

locale.subscribe((l) => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignora */
    }
  }
  if (typeof document !== "undefined") document.documentElement.lang = l;
});

export function setLocale(l: Locale) {
  locale.set(l);
}

function resolve(l: Locale, key: string, params?: Record<string, string | number>): string {
  const table = dict[l] ?? dict.pt;
  let s = table[key] ?? dict.pt[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/** Store reativo para uso no markup: {$t("chave")} ou {$t("chave", { nome })}. */
export const t = derived(locale, ($l) => {
  return (key: string, params?: Record<string, string | number>): string => resolve($l, key, params);
});

/** Versão imperativa para scripts/.ts (lê o idioma atual; não reativa). */
export function tr(key: string, params?: Record<string, string | number>): string {
  return resolve(get(locale), key, params);
}
