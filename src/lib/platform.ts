// Detecção simples de plataforma (sem dependências). No Android/iOS a UA do
// WebView contém o nome do SO. Usado pra adaptar a UI (gaveta, safe-area) e o
// fluxo de vault (armazenamento do app no mobile).
export const isMobile =
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
