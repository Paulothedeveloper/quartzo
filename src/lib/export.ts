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

/** Documento HTML autônomo, com visual premium (letterhead + rodapé) a partir do conteúdo renderizado. */
function standaloneDoc(innerHTML: string, title: string): string {
  let date = "";
  try {
    date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    /* ignora */
  }
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>${EXPORT_CSS}
@page { margin: 18mm; }
@media print { html, body { background: #fff; } .wrap { max-width: 100%; margin: 0; padding: 0; } }
</style>
</head>
<body><div class="wrap">
<header class="doc-head"><span class="brand">✦ Quartzo</span><span class="date">${escapeHtml(date)}</span></header>
${innerHTML}
<footer class="doc-foot">${escapeHtml(title)} · Quartzo</footer>
</div></body>
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

// Folha de estilo "premium" do documento — usada no PDF/impressão e no export HTML.
// Corpo serifado (editorial) + títulos sans, letterhead com a marca, tabelas estilo
// revista, citações/código refinados e rodapé discreto.
const EXPORT_CSS = `
  :root { color-scheme: light; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  html, body { margin: 0; background: #ffffff; }
  body {
    color: #1b2433;
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
    font-size: 11.6pt; line-height: 1.72;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 52px 40px 64px; }

  /* Letterhead */
  .doc-head {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 38px; padding-bottom: 12px; border-bottom: 1px solid #e7edf3;
    font-family: Inter, "Segoe UI", system-ui, sans-serif;
  }
  .doc-head .brand { font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #0e7490; }
  .doc-head .date { font-size: 10.5px; color: #94a3b8; letter-spacing: .03em; }

  /* Títulos (sans, refinados) */
  h1,h2,h3,h4,h5,h6 {
    font-family: Inter, "Segoe UI", system-ui, sans-serif;
    color: #0b1220; line-height: 1.22; font-weight: 700;
    margin: 1.7em 0 .5em; letter-spacing: -0.015em; page-break-after: avoid;
  }
  h1 { font-size: 2.15em; margin-top: 0; letter-spacing: -0.025em; }
  h1::after { content: ""; display: block; width: 58px; height: 3px; margin-top: .4em; border-radius: 2px;
    background: linear-gradient(90deg, #0e7490, #22d3ee); }
  h2 { font-size: 1.5em; padding-bottom: .26em; border-bottom: 1px solid #eef2f7; }
  h3 { font-size: 1.22em; color: #1e293b; }
  h4 { font-size: 1.04em; color: #334155; }
  p { margin: 0 0 1.05em; }
  a { color: #0e7490; text-decoration: none; border-bottom: 1px solid rgba(14,116,144,.32); }
  strong { color: #0b1220; font-weight: 700; }

  /* Listas */
  ul, ol { margin: 0 0 1.1em; padding-left: 1.45em; }
  li { margin: .32em 0; padding-left: .15em; }
  li::marker { color: #0e7490; }

  /* Citações */
  blockquote { margin: 1.4em 0; padding: .5em 1.2em; border-left: 3px solid #67e8f9;
    background: #f8fbfc; color: #475569; font-style: italic; border-radius: 0 8px 8px 0; }
  blockquote p:last-child { margin-bottom: 0; }

  /* Código */
  code { font-family: "JetBrains Mono", ui-monospace, Consolas, monospace; }
  :not(pre) > code { background: #f1f5f9; color: #0f172a; padding: .12em .42em; border-radius: 5px; font-size: .84em; border: 1px solid #e7edf3; }
  pre { background: #f7f9fc; border: 1px solid #e7edf3; border-radius: 11px; padding: 16px 18px; overflow-x: auto; margin: 1.3em 0; line-height: 1.6; page-break-inside: avoid; }
  pre code { background: none; padding: 0; border: none; font-size: .82em; color: #0f172a; }

  /* Tabelas (estilo editorial) */
  table { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-family: Inter, "Segoe UI", system-ui, sans-serif; font-size: .9em; page-break-inside: avoid; }
  th, td { padding: .6em .85em; text-align: left; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  thead th { border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 600; font-size: .82em; text-transform: uppercase; letter-spacing: .04em; }
  tbody tr:last-child td { border-bottom: none; }

  /* Mídia */
  img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid #eef2f7; margin: .6em 0; page-break-inside: avoid; }
  hr { border: none; text-align: center; margin: 2.4em 0; }
  hr::before { content: "✦"; color: #cbd5e1; font-size: 13px; letter-spacing: .4em; }

  /* Callouts */
  .callout { margin: 1.3em 0; border: 1px solid #e2e8f0; border-left-width: 4px; border-radius: 10px; padding: 12px 16px; background: #f8fafc; page-break-inside: avoid; }
  .callout-title { display: flex; align-items: center; gap: .5em; font-weight: 600; color: #0f172a; font-family: Inter, system-ui, sans-serif; }
  .callout-content { margin-top: .4em; color: #334155; }

  /* Rodapé do documento */
  .doc-foot { margin-top: 46px; padding-top: 14px; border-top: 1px solid #eef2f7; text-align: center;
    font-family: Inter, system-ui, sans-serif; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #aeb9c8; }

  /* esconde resíduos do app */
  .q-tc, .q-color-dot, .q-code-copy, .q-ln-gutter { display: none !important; }
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
