import { get, writable } from "svelte/store";

// Onboarding por COACHMARKS contextuais (regra do Manual: dica 1x quando o usuário
// CHEGA na feature — NÃO slideshow inicial). Persistido: cada dica aparece uma vez.
const KEY = "quartzo:coachmarks";
const ALL = "quartzo:coachmarksAllDone";

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}
let seen = typeof localStorage !== "undefined" ? load() : new Set<string>();
let allDone = typeof localStorage !== "undefined" && localStorage.getItem(ALL) === "1";

export type Coach = { id: string; title: string; body: string };
export const activeCoach = writable<Coach | null>(null);

/** Mostra a dica UMA vez. Ignora se já vista, se o usuário pulou tudo, ou se já há
 *  uma dica na tela (aí ela aparece numa próxima visita — não marca como vista). */
export function showCoachmark(c: Coach) {
  if (typeof localStorage === "undefined") return;
  if (allDone || seen.has(c.id) || get(activeCoach)) return;
  activeCoach.set(c);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    /* ignora */
  }
}

/** "Entendi" — marca só esta dica como vista. */
export function dismissCoach(id: string) {
  seen.add(id);
  persist();
  activeCoach.set(null);
}

/** "Não mostrar dicas" — desliga todas de uma vez. */
export function skipAllCoach() {
  allDone = true;
  try {
    localStorage.setItem(ALL, "1");
  } catch {
    /* ignora */
  }
  activeCoach.set(null);
}

/** Reabre o onboarding contextual (usado pelo comando "ver tutorial"). */
export function resetCoachmarks() {
  seen = new Set();
  allDone = false;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(ALL);
  } catch {
    /* ignora */
  }
}
