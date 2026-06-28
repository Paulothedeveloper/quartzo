// Exportar a nota renderizada: PDF (via impressão do sistema) e HTML standalone.
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { get } from "svelte/store";
import { showToast } from "$lib/stores/toast";
import { currentVaultPath } from "$lib/stores/vault";
import { activeTabPath } from "$lib/stores/tabs";
import { tr } from "$lib/i18n";

function activeProse(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".q-prose");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function noteTitle(): string {
  return (get(activeTabPath)?.split(/[\\/]/).pop() ?? "nota").replace(/\.md$/i, "");
}

/** Documento HTML autônomo (limpo, claro, centralizado) a partir do conteúdo renderizado. */
function standaloneDoc(innerHTML: string, title: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>${EXPORT_CSS}
@page { margin: 16mm; }
@media print { html, body { background: #fff; } .wrap { max-width: 100%; margin: 0; padding: 0; } }
</style>
</head>
<body><div class="wrap">${innerHTML}</div></body>
</html>`;
}

/** Imprime/salva a nota como PDF num documento ISOLADO (iframe) — sem o layout do app
 *  vazar, com o título certo. Use o diálogo do sistema e escolha "Salvar como PDF". */
export function printNote() {
  const prose = activeProse();
  if (!prose) {
    showToast(tr("export.openReadingFirst"), "info");
    return;
  }
  const clone = prose.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".q-code-copy, .q-ln-gutter").forEach((e) => e.remove());
  const doc = standaloneDoc(clone.innerHTML, noteTitle());

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const cw = iframe.contentWindow;
  const idoc = cw?.document;
  if (!cw || !idoc) {
    iframe.remove();
    return;
  }
  idoc.open();
  idoc.write(doc);
  idoc.close();
  const go = () => {
    try {
      cw.focus();
      cw.print();
    } catch {
      /* ignora */
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  };
  // espera o documento (e imagens) montarem
  if (idoc.readyState === "complete") setTimeout(go, 300);
  else iframe.onload = () => setTimeout(go, 300);
}

const EXPORT_CSS = `
  :root { color-scheme: light; }
  body { margin: 0; background: #fff; color: #1f2733; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 48px 32px; line-height: 1.75; font-size: 16px; }
  h1,h2,h3,h4 { color: #0f172a; line-height: 1.25; margin: 1.6em 0 .5em; }
  h1 { font-size: 1.9em; border-bottom: 1px solid #e2e8f0; padding-bottom: .3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eef2f7; padding-bottom: .25em; }
  a { color: #0e7490; text-decoration: none; }
  code { font-family: ui-monospace, "JetBrains Mono", Consolas, monospace; }
  :not(pre) > code { background: #eef2f7; color: #be123c; padding: .15em .4em; border-radius: 5px; font-size: .88em; }
  pre { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #cbd5e1; margin: 1.2em 0; padding: .2em 1em; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: .92em; }
  th, td { border: 1px solid #e2e8f0; padding: .55em .9em; text-align: left; }
  thead th { background: #eef2f7; }
  img { max-width: 100%; border-radius: 8px; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
  .callout { margin: 1.2em 0; border: 1px solid #cbd5e1; border-left-width: 4px; border-radius: 8px; padding: 12px 16px; background: #f8fafc; }
  .callout-title { display: flex; align-items: center; gap: .5em; font-weight: 600; color: #0f172a; }
  .callout-content { margin-top: .4em; color: #334155; }
  .q-tc, .q-color-dot { display: none; }
  .q-code-copy, .q-ln-gutter { display: none !important; }
`;

/** Exporta a nota renderizada como um arquivo HTML autônomo. */
export async function exportNoteHtml(name: string) {
  const prose = activeProse();
  if (!prose) {
    showToast(tr("export.openReadingFirst"), "info");
    return;
  }
  const clone = prose.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".q-code-copy, .q-ln-gutter").forEach((e) => e.remove());
  const title = (name || "nota").replace(/\.md$/i, "");
  const doc = standaloneDoc(clone.innerHTML, title);
  try {
    const path = await save({
      defaultPath: `${title}.html`,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (!path) return;
    await invoke("write_file", { path, content: doc });
    showToast("HTML exportado", "success");
  } catch (e) {
    showToast(`Erro ao exportar: ${e}`, "error");
  }
}

/** Exporta a nota ativa como .docx (gerador nativo — sem ferramentas externas). */
export async function exportDocx() {
  const vault = get(currentVaultPath);
  const note = get(activeTabPath);
  if (!vault || !note) {
    showToast(tr("toast.openVaultFirst"), "info");
    return;
  }
  const base = (note.split(/[\\/]/).pop() ?? "nota").replace(/\.md$/i, "");
  let dest: string | null;
  try {
    dest = await save({
      defaultPath: `${base}.docx`,
      filters: [{ name: "Word (DOCX)", extensions: ["docx"] }],
    });
  } catch {
    dest = null;
  }
  if (!dest) return;
  showToast(tr("export.docxRunning"), "info");
  try {
    await invoke("export_docx", { vault, notePath: note, dest });
    showToast(tr("export.docxDone"), "success");
  } catch (e) {
    showToast(tr("export.docxError", { error: String(e) }), "error");
  }
}
