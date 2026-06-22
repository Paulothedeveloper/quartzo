import { writable } from "svelte/store";
import { sfx } from "$lib/sfx";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export const toasts = writable<Toast[]>([]);

let counter = 0;

/** Mostra um toast temporário. */
export function showToast(message: string, type: ToastType = "info", duration = 3000) {
  const id = ++counter;
  toasts.update((all) => [...all, { id, message, type }]);
  if (type === "success") sfx.success();
  else if (type === "error") sfx.error();
  else sfx.info();
  setTimeout(() => {
    toasts.update((all) => all.filter((t) => t.id !== id));
  }, duration);
}
