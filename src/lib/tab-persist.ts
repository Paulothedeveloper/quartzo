// Persiste as abas abertas por vault (só caminhos + aba ativa) pra restaurar a sessão.
const KEY = "quartzo:tabs:";

interface Saved {
  paths: string[];
  active: string | null;
}

export function saveTabs(vault: string | null, paths: string[], active: string | null): void {
  if (!vault || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY + vault, JSON.stringify({ paths, active } satisfies Saved));
  } catch {
    /* ignora */
  }
}

export function loadTabs(vault: string | null): Saved {
  if (!vault || typeof localStorage === "undefined") return { paths: [], active: null };
  try {
    const raw = localStorage.getItem(KEY + vault);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (Array.isArray(s.paths)) return s;
    }
  } catch {
    /* ignora */
  }
  return { paths: [], active: null };
}
