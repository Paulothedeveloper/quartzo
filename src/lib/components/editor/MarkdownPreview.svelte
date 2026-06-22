<script lang="ts" module>
  import { marked } from "marked";
  import { markedHighlight } from "marked-highlight";
  import katex from "katex";
  import "katex/dist/katex.min.css";
  import mermaid from "mermaid";
  import hljs from "highlight.js/lib/core";
  import "highlight.js/styles/github-dark.css";

  // Registra só as linguagens comuns (evita bundle de ~1.5MB com 190 langs).
  import javascript from "highlight.js/lib/languages/javascript";
  import typescript from "highlight.js/lib/languages/typescript";
  import python from "highlight.js/lib/languages/python";
  import rust from "highlight.js/lib/languages/rust";
  import bash from "highlight.js/lib/languages/bash";
  import json from "highlight.js/lib/languages/json";
  import yaml from "highlight.js/lib/languages/yaml";
  import xml from "highlight.js/lib/languages/xml";
  import css from "highlight.js/lib/languages/css";
  import markdown from "highlight.js/lib/languages/markdown";
  import sql from "highlight.js/lib/languages/sql";
  import go from "highlight.js/lib/languages/go";
  import java from "highlight.js/lib/languages/java";
  import cpp from "highlight.js/lib/languages/cpp";
  import csharp from "highlight.js/lib/languages/csharp";
  import php from "highlight.js/lib/languages/php";
  import kotlin from "highlight.js/lib/languages/kotlin";
  import swift from "highlight.js/lib/languages/swift";
  import dart from "highlight.js/lib/languages/dart";
  import ruby from "highlight.js/lib/languages/ruby";
  import lua from "highlight.js/lib/languages/lua";
  import dockerfile from "highlight.js/lib/languages/dockerfile";
  import ini from "highlight.js/lib/languages/ini";
  import diff from "highlight.js/lib/languages/diff";
  import graphql from "highlight.js/lib/languages/graphql";
  import scss from "highlight.js/lib/languages/scss";
  import powershell from "highlight.js/lib/languages/powershell";
  import makefile from "highlight.js/lib/languages/makefile";
  import objectivec from "highlight.js/lib/languages/objectivec";
  import perl from "highlight.js/lib/languages/perl";
  import r from "highlight.js/lib/languages/r";
  import scala from "highlight.js/lib/languages/scala";
  import haskell from "highlight.js/lib/languages/haskell";
  import elixir from "highlight.js/lib/languages/elixir";
  import plaintext from "highlight.js/lib/languages/plaintext";

  for (const [name, lang] of Object.entries({
    javascript, typescript, python, rust, bash, json, yaml, xml, css, markdown,
    sql, go, java, cpp, csharp, php, kotlin, swift, dart, ruby, lua, dockerfile,
    ini, diff, graphql, scss, powershell, makefile, objectivec, perl, r, scala,
    haskell, elixir, plaintext,
  })) {
    hljs.registerLanguage(name, lang as any);
  }
  hljs.registerAliases(["js"], { languageName: "javascript" });
  hljs.registerAliases(["ts"], { languageName: "typescript" });
  hljs.registerAliases(["py"], { languageName: "python" });
  hljs.registerAliases(["sh", "shell", "zsh"], { languageName: "bash" });
  hljs.registerAliases(["html", "svelte", "vue"], { languageName: "xml" });
  hljs.registerAliases(["yml"], { languageName: "yaml" });
  hljs.registerAliases(["c++", "c"], { languageName: "cpp" });
  hljs.registerAliases(["cs"], { languageName: "csharp" });
  hljs.registerAliases(["kt"], { languageName: "kotlin" });
  hljs.registerAliases(["rb"], { languageName: "ruby" });
  hljs.registerAliases(["ps1"], { languageName: "powershell" });
  hljs.registerAliases(["dockerfile"], { languageName: "dockerfile" });
  hljs.registerAliases(["toml"], { languageName: "ini" });
  hljs.registerAliases(["text", "txt"], { languageName: "plaintext" });

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  export interface Prop {
    key: string;
    values: string[];
  }
  function stripQuotes(s: string): string {
    return s.replace(/^["']|["']$/g, "");
  }
  /** Separa frontmatter YAML (properties) do corpo markdown. */
  export function parseFrontmatter(content: string): { props: Prop[]; body: string } {
    if (!content.startsWith("---")) return { props: [], body: content };
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { props: [], body: content };
    const body = content.slice(m[0].length);
    const props: Prop[] = [];
    let cur: Prop | null = null;
    for (const line of m[1].split(/\r?\n/)) {
      if (!line.trim()) continue;
      const li = line.match(/^\s*-\s+(.*)$/);
      if (li && cur) {
        cur.values.push(stripQuotes(li[1].trim()));
        continue;
      }
      const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
      if (kv) {
        const p: Prop = { key: kv[1], values: [] };
        const val = kv[2].trim();
        if (val.startsWith("[") && val.endsWith("]")) {
          val
            .slice(1, -1)
            .split(",")
            .map((s) => stripQuotes(s.trim()))
            .filter(Boolean)
            .forEach((v) => p.values.push(v));
        } else if (val) {
          p.values.push(stripQuotes(val));
        }
        props.push(p);
        cur = p;
      }
    }
    return { props, body };
  }

  // Configura o marked uma única vez (nível de módulo).
  marked.use(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        // Só destaca se a linguagem estiver registrada; senão escapa sem highlight.
        // (NUNCA chamar hljs.highlight com lang inexistente — lança e congela o preview.)
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch {
            /* cai no escape abaixo */
          }
        }
        return escapeHtml(code);
      },
    })
  );
  marked.use({ breaks: true, gfm: true });

  /** Renderiza um trecho de math com KaTeX (display = bloco $$). */
  export function renderMathToken(src: string, display: boolean): string {
    try {
      return katex.renderToString(src, { throwOnError: false, displayMode: display });
    } catch {
      return escapeHtml(src);
    }
  }

  /** Protege $$bloco$$ e $inline$ antes do markdown (senão _ * quebram) e devolve os tokens. */
  export function protectMath(body: string): { body: string; tokens: { ph: string; html: string }[] } {
    const tokens: { ph: string; html: string }[] = [];
    let out = body.replace(/\$\$([\s\S]+?)\$\$/g, (_m, e) => {
      const ph = `@@QMATH${tokens.length}@@`;
      tokens.push({ ph, html: renderMathToken(String(e).trim(), true) });
      return ph;
    });
    out = out.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (_m, e) => {
      const ph = `@@QMATH${tokens.length}@@`;
      tokens.push({ ph, html: renderMathToken(String(e), false) });
      return ph;
    });
    return { body: out, tokens };
  }

  /** Renderiza os blocos ```mermaid já presentes no DOM do preview (substitui o <pre> pelo SVG). */
  export async function renderMermaidIn(root: HTMLElement): Promise<void> {
    if (typeof window === "undefined") return;
    const blocks = root.querySelectorAll<HTMLElement>("code.language-mermaid");
    if (!blocks.length) return;
    const light = document.documentElement.classList.contains("theme-light");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: light ? "default" : "dark",
      fontFamily: "var(--font-sans)",
    });
    let i = 0;
    for (const code of Array.from(blocks)) {
      const host = (code.closest("pre") as HTMLElement) ?? code;
      const src = code.textContent ?? "";
      if (!src.trim()) continue;
      const id = "qmermaid-" + Math.abs(hashStr(src)) + "-" + i++;
      try {
        const { svg } = await mermaid.render(id, src);
        const wrap = document.createElement("div");
        wrap.className = "q-mermaid";
        wrap.innerHTML = svg;
        host.replaceWith(wrap);
      } catch {
        host.classList.add("q-mermaid-error");
      }
    }
  }

  function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  const CALLOUTS: Record<string, { cls: string; icon: string }> = {
    note: { cls: "note", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" },
    info: { cls: "info", icon: "M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" },
    tip: { cls: "tip", icon: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" },
    hint: { cls: "tip", icon: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" },
    success: { cls: "success", icon: "M20 6 9 17l-5-5" },
    check: { cls: "success", icon: "M20 6 9 17l-5-5" },
    question: { cls: "question", icon: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" },
    warning: { cls: "warning", icon: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" },
    caution: { cls: "warning", icon: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" },
    danger: { cls: "danger", icon: "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" },
    error: { cls: "danger", icon: "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" },
    bug: { cls: "danger", icon: "M8 2 10 5M16 2 14 5M12 20v-9M5 9h14M5 13H3M21 13h-2M5 17H3M21 17h-2M12 20a6 6 0 0 0 6-6V9a6 6 0 0 0-12 0v5a6 6 0 0 0 6 6Z" },
    quote: { cls: "quote", icon: "M3 21c3 0 7-1 7-8V5H4v7h3M14 21c3 0 7-1 7-8V5h-6v7h3" },
  };

  function iconSvg(path: string): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  }

  function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Transforma callouts, wikilinks e imagens no HTML já renderizado pelo marked. */
  function enhance(
    html: string,
    opts: {
      embedSrc?: (t: string) => string | null;
      relSrc?: (s: string) => string | null;
      inlineColors?: boolean;
      codeCopy?: boolean;
      codeLineNumbers?: boolean;
      timecodes?: boolean;
    } = {}
  ): string {
    if (typeof document === "undefined") return html;
    const tpl = document.createElement("template");
    tpl.innerHTML = html;

    // --- Embeds de imagem: ![[arquivo.png]] (em nós de texto, fora de code) ---
    if (opts.embedSrc) {
      const w0 = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      const embeds: Text[] = [];
      while (w0.nextNode()) {
        const n = w0.currentNode as Text;
        if ((n.parentElement as Element)?.closest("code,pre,a")) continue;
        if (/!\[\[[^\]\n]+\]\]/.test(n.nodeValue ?? "")) embeds.push(n);
      }
      for (const node of embeds) {
        const text = node.nodeValue ?? "";
        const frag = document.createDocumentFragment();
        const re = /!\[\[([^\]\n]+)\]\]/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          const src = opts.embedSrc(m[1]);
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.loading = "lazy";
            frag.appendChild(img);
          } else {
            frag.appendChild(document.createTextNode(m[0]));
          }
          last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      }
    }

    // --- Callouts: > [!tipo] Título ---
    tpl.content.querySelectorAll("blockquote").forEach((bq) => {
      const head = bq.innerHTML.match(/^\s*<p>\s*\[!(\w+)\][+-]?[ \t]*([^\n<]*)/i);
      if (!head) return;
      const key = head[1].toLowerCase();
      const meta = CALLOUTS[key] ?? CALLOUTS.note;
      const title = head[2].trim() || cap(key);
      let body = bq.innerHTML.replace(/^(\s*<p>)\s*\[!\w+\][+-]?[ \t]*[^\n<]*(<br\s*\/?>)?/i, "$1");
      body = body.replace(/^\s*<p>\s*<\/p>/i, "");
      const div = document.createElement("div");
      div.className = `callout callout-${meta.cls}`;
      div.innerHTML = `<div class="callout-title">${iconSvg(meta.icon)}<span>${title}</span></div><div class="callout-content">${body}</div>`;
      bq.replaceWith(div);
    });

    // --- Wikilinks em nós de texto (fora de code/pre/a) ---
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if ((node.parentElement as Element)?.closest("code,pre,a")) continue;
      if (/\[\[[^\]\n]+\]\]/.test(node.nodeValue ?? "")) targets.push(node);
    }
    for (const node of targets) {
      const text = node.nodeValue ?? "";
      const frag = document.createDocumentFragment();
      const re = /\[\[([^\]\n]+)\]\]/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const [target, alias] = m[1].split("|");
        const a = document.createElement("a");
        a.className = "wikilink";
        a.dataset.target = target.trim();
        a.textContent = (alias ?? target).trim();
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    }

    // --- Timecodes [mm:ss] / [hh:mm:ss] viram links que pulam o player ---
    if (opts.timecodes) {
      const tw = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      const tcNodes: Text[] = [];
      while (tw.nextNode()) {
        const n = tw.currentNode as Text;
        if ((n.parentElement as Element)?.closest("pre,code,a,.q-tc")) continue;
        if (/\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(n.nodeValue ?? "")) tcNodes.push(n);
      }
      for (const node of tcNodes) {
        const text = node.nodeValue ?? "";
        const frag = document.createDocumentFragment();
        const re = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const span = document.createElement("span");
          span.className = "q-tc";
          span.setAttribute("data-tc", m[1]);
          span.textContent = m[0];
          frag.appendChild(span);
          last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      }
    }

    // --- Cor inline: #RRGGBB / #RGB ganha um swatch ao lado ---
    if (opts.inlineColors) {
      const cw = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      const colorNodes: Text[] = [];
      while (cw.nextNode()) {
        const n = cw.currentNode as Text;
        if ((n.parentElement as Element)?.closest("pre,a,.q-color")) continue;
        if (/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/.test(n.nodeValue ?? "")) colorNodes.push(n);
      }
      for (const node of colorNodes) {
        const text = node.nodeValue ?? "";
        const frag = document.createDocumentFragment();
        const re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const span = document.createElement("span");
          span.className = "q-color";
          const dot = document.createElement("span");
          dot.className = "q-color-dot";
          dot.style.background = m[0];
          span.appendChild(dot);
          span.appendChild(document.createTextNode(m[0]));
          frag.appendChild(span);
          last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      }
    }

    // --- Blocos de código: badge de linguagem + copiar + números de linha ---
    tpl.content.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      if (!code || code.classList.contains("language-mermaid")) return;
      pre.classList.add("q-code");
      const langClass = [...code.classList].find((c) => c.startsWith("language-"));
      const lang = langClass ? langClass.replace("language-", "") : "";
      if (lang) pre.setAttribute("data-lang", lang);
      if (opts.codeLineNumbers) {
        const n = (code.textContent ?? "").replace(/\n$/, "").split("\n").length;
        pre.classList.add("q-ln");
        const gutter = document.createElement("span");
        gutter.className = "q-ln-gutter";
        gutter.setAttribute("aria-hidden", "true");
        gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
        pre.insertBefore(gutter, pre.firstChild);
      }
      if (opts.codeCopy) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "q-code-copy";
        btn.setAttribute("data-code-copy", "");
        btn.textContent = "Copiar";
        pre.appendChild(btn);
      }
    });

    // --- Imagens com caminho relativo: ![](sub/img.png) -> asset local ---
    if (opts.relSrc) {
      tpl.content.querySelectorAll("img").forEach((img) => {
        const s = img.getAttribute("src") ?? "";
        if (s && !/^(https?:|data:|asset:|blob:|tauri:|http:\/\/asset)/i.test(s)) {
          const ns = opts.relSrc!(s);
          if (ns) img.setAttribute("src", ns);
        }
        img.setAttribute("loading", "lazy");
      });
    }

    return tpl.innerHTML;
  }
</script>

<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { convertFileSrc, invoke } from "@tauri-apps/api/core";
  import { flatFiles } from "$lib/vault-actions";
  import { settings } from "$lib/stores/settings";
  import { showToast } from "$lib/stores/toast";
  import { currentVaultPath } from "$lib/stores/vault";
  import { queryIndex, loadQueryIndex, buildQueryView } from "$lib/query";
  import { activeVideoSeek, parseTC } from "$lib/video";
  import { hoverWikilink, clearHoverPreview } from "$lib/hover-preview";
  import VideoReview from "./VideoReview.svelte";
  import { get } from "svelte/store";
  import { untrack } from "svelte";

  let {
    content = "",
    notePath = "",
    onOpenWikilink,
    onOpenPath,
    onScroller,
  }: {
    content?: string;
    notePath?: string;
    onOpenWikilink?: (target: string) => void;
    onOpenPath?: (path: string) => void;
    onScroller?: (el: HTMLElement) => void;
  } = $props();

  const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
  function noteDir(p: string): string {
    return p ? p.replace(/[\\/][^\\/]*$/, "") : "";
  }
  function joinPath(dir: string, rel: string): string {
    rel = rel.replace(/\\/g, "/");
    if (/^[a-zA-Z]:\//.test(rel) || rel.startsWith("/")) return rel;
    const parts = (dir.replace(/\\/g, "/") + "/" + rel).split("/");
    const out: string[] = [];
    for (const part of parts) {
      if (part === "..") out.pop();
      else if (part !== "." && part !== "") out.push(part);
    }
    return out.join("/");
  }
  function safeSrc(abs: string): string {
    try {
      return convertFileSrc(abs);
    } catch {
      return abs;
    }
  }
  // ![[arquivo.png]] -> resolve por nome no vault (ou relativo à nota)
  function embedSrc(target: string): string | null {
    const clean = target.split("|")[0].split("#")[0].trim();
    if (!IMG_EXT.test(clean)) return null;
    const files = flatFiles();
    const lc = clean.toLowerCase();
    const f =
      files.find((x) => x.name.toLowerCase() === lc) ??
      files.find((x) => x.path.replace(/\\/g, "/").toLowerCase().endsWith("/" + lc));
    const abs = f?.path ?? (notePath ? joinPath(noteDir(notePath), clean) : null);
    return abs ? safeSrc(abs) : null;
  }
  // ![](sub/img.png) -> resolve relativo à nota atual
  function relSrc(src: string): string | null {
    if (!notePath) return null;
    return safeSrc(joinPath(noteDir(notePath), src));
  }

  // ```video path: ... ``` -> resolve o vídeo local (por nome no vault ou relativo à nota)
  const VIDEO_EXT = /\.(mp4|webm|m4v|mov|ogg|ogv)$/i;
  function videoSrc(target: string): string | null {
    const clean = target.split("|")[0].trim();
    if (!clean) return null;
    const files = flatFiles();
    const lc = clean.toLowerCase();
    const f =
      files.find((x) => x.name.toLowerCase() === lc) ??
      files.find((x) => x.path.replace(/\\/g, "/").toLowerCase().endsWith("/" + lc));
    let abs = f?.path ?? null;
    if (!abs) {
      if (/^[a-zA-Z]:[\\/]/.test(clean) || clean.startsWith("/")) abs = clean;
      else if (notePath) abs = joinPath(noteDir(notePath), clean);
    }
    if (!abs) return null;
    if (!VIDEO_EXT.test(abs)) return null;
    return safeSrc(abs);
  }

  const VIDEO_BLOCK = /```video\s*\n([\s\S]*?)```/;
  const videoBlock = $derived.by(() => {
    const m = VIDEO_BLOCK.exec(parsed.body);
    if (!m) return null;
    let path = "";
    let fps = 30;
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const k = line.slice(0, i).trim().toLowerCase();
      const v = line.slice(i + 1).trim();
      if (k === "path" || k === "src" || k === "file") path = v;
      else if (k === "fps") fps = parseFloat(v) || 30;
    }
    if (!path) return null;
    const src = videoSrc(path);
    return src ? { src, fps } : null;
  });

  let rootEl = $state<HTMLElement>();
  $effect(() => {
    if (rootEl) onScroller?.(rootEl);
  });

  // Debounce do conteúdo p/ o preview pesado (Mermaid/query/math) não re-renderizar a cada tecla.
  let rendered = $state(content);
  $effect(() => {
    const c = content;
    if (c === untrack(() => rendered)) return;
    const t = setTimeout(() => (rendered = c), 160);
    return () => clearTimeout(t);
  });

  const parsed = $derived.by(() => parseFrontmatter(rendered));
  const html = $derived.by(() => {
    if (!parsed.body.trim()) return "";
    try {
      // remove os blocos ```video (renderizados no player persistente, fora do {@html})
      let body = $settings.renderVideo ? parsed.body.replace(/```video\s*\n[\s\S]*?```/g, "") : parsed.body;
      let mathTokens: { ph: string; html: string }[] = [];
      if ($settings.renderMath) {
        const m = protectMath(body);
        body = m.body;
        mathTokens = m.tokens;
      }
      let out = enhance(marked.parse(body) as string, {
        embedSrc,
        relSrc,
        inlineColors: $settings.inlineColors,
        codeCopy: $settings.codeCopyButton,
        codeLineNumbers: $settings.codeLineNumbers,
        timecodes: $settings.renderVideo,
      });
      for (const t of mathTokens) out = out.split(t.ph).join(t.html);
      return out;
    } catch (e) {
      console.error("Falha ao renderizar preview:", e);
      return `<pre>${escapeHtml(parsed.body)}</pre>`;
    }
  });

  // Renderiza os diagramas Mermaid depois que o HTML é injetado no DOM.
  $effect(() => {
    html; // dependência: re-renderiza ao mudar conteúdo
    const root = rootEl;
    if (!root || !$settings.renderMermaid) return;
    queueMicrotask(() => renderMermaidIn(root));
  });

  // Carrega o índice de consulta ao entrar num vault.
  $effect(() => {
    loadQueryIndex($currentVaultPath);
  });

  // Renderiza as views ```query (re-renderiza quando o índice muda).
  $effect(() => {
    html;
    const index = $queryIndex;
    const root = rootEl;
    if (!root || !$settings.renderQueries) return;
    queueMicrotask(() => {
      // re-renderiza views já existentes (índice mudou) e blocos novos
      root.querySelectorAll(".q-query[data-qcfg]").forEach((node) => {
        const cfg = decodeURIComponent(node.getAttribute("data-qcfg") ?? "");
        node.replaceWith(buildQueryView(cfg, index));
      });
      root.querySelectorAll("code.language-query").forEach((code) => {
        const host = (code.closest("pre") as HTMLElement) ?? code;
        host.replaceWith(buildQueryView(code.textContent ?? "", index));
      });
    });
  });

  // Action: anexa o handler de clique sem onclick inline (evita falso-positivo de a11y).
  function onOver(e: MouseEvent) {
    const wl = (e.target as HTMLElement).closest<HTMLElement>(".wikilink");
    if (wl?.dataset.target) {
      const r = wl.getBoundingClientRect();
      hoverWikilink(wl.dataset.target, r.left, r.bottom, e.ctrlKey || e.metaKey);
    }
  }
  function onOut(e: MouseEvent) {
    if ((e.target as HTMLElement).closest?.(".wikilink")) clearHoverPreview();
  }
  function delegateClick(node: HTMLElement) {
    node.addEventListener("click", onClick);
    node.addEventListener("mouseover", onOver);
    node.addEventListener("mouseout", onOut);
    return {
      destroy: () => {
        node.removeEventListener("click", onClick);
        node.removeEventListener("mouseover", onOver);
        node.removeEventListener("mouseout", onOut);
      },
    };
  }

  async function onClick(e: MouseEvent) {
    const el = e.target as HTMLElement;

    // Clique num timecode [mm:ss] -> pula o player de vídeo
    const tc = el.closest<HTMLElement>(".q-tc[data-tc]");
    if (tc) {
      e.preventDefault();
      get(activeVideoSeek)?.(parseTC(tc.getAttribute("data-tc")!));
      return;
    }

    // Marcar/desmarcar tarefa numa view ```query
    const task = el.closest<HTMLInputElement>("[data-qtask-path]");
    if (task) {
      const path = task.getAttribute("data-qtask-path")!;
      const line = Number(task.getAttribute("data-qtask-line") ?? "0");
      try {
        await invoke("toggle_task", { path, line });
        await loadQueryIndex($currentVaultPath, true);
      } catch {
        showToast("Erro ao atualizar tarefa", "error");
      }
      return; // deixa o checkbox alternar visualmente
    }
    // Abrir nota a partir de uma view ```query
    const qopen = el.closest<HTMLElement>("[data-qopen]");
    if (qopen) {
      e.preventDefault();
      onOpenPath?.(qopen.getAttribute("data-qopen")!);
      return;
    }

    const copyBtn = el.closest<HTMLElement>("[data-code-copy]");
    if (copyBtn) {
      e.preventDefault();
      const code = copyBtn.closest("pre")?.querySelector("code");
      const text = code?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copiado!";
        showToast("Código copiado", "success");
        setTimeout(() => (copyBtn.textContent = "Copiar"), 1400);
      } catch {
        showToast("Não foi possível copiar", "error");
      }
      return;
    }
    const wl = el.closest<HTMLElement>(".wikilink");
    if (wl?.dataset.target) {
      e.preventDefault();
      onOpenWikilink?.(wl.dataset.target);
      return;
    }
    const link = el.closest<HTMLAnchorElement>("a[href]");
    if (link) {
      const href = link.getAttribute("href") ?? "";
      if (/^https?:/i.test(href)) {
        e.preventDefault();
        await openUrl(href);
      }
    }
  }
</script>

<div class="q-prose h-full overflow-auto px-10 py-8" bind:this={rootEl} use:delegateClick>
  {#if videoBlock && $settings.renderVideo}
    <VideoReview src={videoBlock.src} fps={videoBlock.fps} {content} />
  {/if}
  {#if parsed.props.length}
    <div class="q-props">
      {#each parsed.props as p (p.key)}
        <div class="q-prop">
          <span class="q-prop-key">{p.key}</span>
          <span class="q-prop-vals">
            {#if p.values.length === 0}
              <span class="q-prop-empty">—</span>
            {:else if p.values.length === 1}
              <span class="q-prop-val">{p.values[0]}</span>
            {:else}
              {#each p.values as v (v)}<span class="q-prop-chip">{v}</span>{/each}
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}
  {#if html}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html html}
  {:else if !parsed.props.length}
    <p class="text-text-secondary">O preview aparece aqui conforme você escreve…</p>
  {/if}
</div>

<style>
  .q-props {
    margin-bottom: 1.4rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: rgba(28, 37, 54, 0.35);
    overflow: hidden;
  }
  .q-prop {
    display: flex;
    gap: 12px;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  }
  .q-prop:last-child {
    border-bottom: none;
  }
  .q-prop-key {
    min-width: 90px;
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: lowercase;
    padding-top: 2px;
  }
  .q-prop-vals {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: 13.5px;
    color: var(--color-text-primary);
  }
  .q-prop-chip {
    border-radius: 9999px;
    background: rgba(103, 232, 249, 0.12);
    color: var(--color-accent-light);
    padding: 1px 9px;
    font-size: 12px;
  }
  .q-prop-empty {
    color: var(--color-text-muted);
  }
</style>
