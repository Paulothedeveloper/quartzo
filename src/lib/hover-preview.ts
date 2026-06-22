import { get } from "svelte/store";
import { hoverPreviewTarget } from "$lib/stores/ui";
import { settings } from "$lib/stores/settings";
import { resolveWikilink } from "$lib/vault-actions";

let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Pediu para espiar um [[wikilink]] — agenda a pré-visualização (com pequeno atraso). */
export function hoverWikilink(target: string, x: number, y: number, ctrlKey: boolean) {
  const s = get(settings);
  if (!s.hoverPreview) return;
  if (s.hoverPreviewCtrl && !ctrlKey) return;
  const path = resolveWikilink(target);
  if (!path) return;
  clearTimeout(hideTimer);
  clearTimeout(showTimer);
  showTimer = setTimeout(() => hoverPreviewTarget.set({ path, x, y }), 320);
}

/** Saiu do wikilink — esconde a pré-visualização (com pequeno atraso anti-flicker). */
export function clearHoverPreview() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => hoverPreviewTarget.set(null), 120);
}
