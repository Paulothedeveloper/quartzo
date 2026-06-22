<script lang="ts">
  import { untrack, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import {
    EditorView,
    keymap,
    drawSelection,
    highlightActiveLine,
    lineNumbers,
    MatchDecorator,
    Decoration,
    ViewPlugin,
    type DecorationSet,
  } from "@codemirror/view";
  import { EditorState, Annotation, Compartment } from "@codemirror/state";
  import { autocompletion, type CompletionContext, type Completion } from "@codemirror/autocomplete";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { syntaxHighlighting, HighlightStyle, bracketMatching, indentUnit } from "@codemirror/language";
  import { markdown } from "@codemirror/lang-markdown";
  import { languages } from "@codemirror/language-data";
  import { tags as t } from "@lezer/highlight";
  import { vim } from "@replit/codemirror-vim";
  import { settings, FONT_STACK, type Settings } from "$lib/stores/settings";
  import { activeEditorView } from "$lib/stores/editor";
  import { pickColor } from "$lib/color";

  let {
    doc = "",
    path = "",
    onChange,
    onOpenWikilink,
    onScroller,
  }: {
    doc?: string;
    path?: string;
    onChange?: (value: string) => void;
    onOpenWikilink?: (target: string) => void;
    onScroller?: (el: HTMLElement) => void;
  } = $props();

  let host = $state<HTMLDivElement>();
  let view: EditorView | undefined;

  const External = Annotation.define<boolean>();

  // ---- Realce de [[wikilinks]] ----
  const wikiMatcher = new MatchDecorator({
    regexp: /\[\[([^\]\n]+)\]\]/g,
    decoration: () => Decoration.mark({ class: "cm-wikilink" }),
  });
  const wikiPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(v: EditorView) {
        this.decorations = wikiMatcher.createDeco(v);
      }
      update(u: any) {
        this.decorations = wikiMatcher.updateDeco(u, this.decorations);
      }
    },
    { decorations: (v) => v.decorations }
  );

  // ---- Tema (cores, ciano cristalino) ----
  // Cores via var(--cm-*) p/ adaptarem ao tema (definidas em app.css).
  const lumTheme = EditorView.theme({
    "&": { height: "100%", backgroundColor: "transparent", color: "var(--cm-text)" },
    ".cm-scroller": { lineHeight: "1.75", overflow: "auto" },
    ".cm-content": { padding: "28px 40px", maxWidth: "920px", caretColor: "var(--cm-caret)" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--cm-caret)", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--cm-sel)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--cm-activeline-bg)",
      boxShadow: "inset 2px 0 0 var(--cm-activeline-bar)",
    },
    ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--cm-gutter)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(148,163,184,0.06)" },
    ".cm-wikilink": { color: "var(--cm-link)", cursor: "pointer", borderRadius: "3px" },
    ".cm-wikilink:hover": {
      backgroundColor: "var(--cm-sel)",
      textDecoration: "underline",
    },
  });

  const lumHighlight = HighlightStyle.define([
    { tag: t.heading1, fontSize: "1.7em", fontWeight: "700", color: "var(--cm-h)", lineHeight: "1.3" },
    { tag: t.heading2, fontSize: "1.45em", fontWeight: "700", color: "var(--cm-h)" },
    { tag: t.heading3, fontSize: "1.22em", fontWeight: "600", color: "var(--cm-h3)" },
    { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "600", color: "var(--cm-list)" },
    { tag: t.strong, fontWeight: "700", color: "var(--cm-strong)" },
    { tag: t.emphasis, fontStyle: "italic", color: "var(--cm-text)" },
    { tag: t.strikethrough, textDecoration: "line-through", color: "var(--cm-quote)" },
    { tag: t.link, color: "var(--cm-link)" },
    { tag: t.url, color: "var(--cm-url)" },
    { tag: t.quote, color: "var(--cm-quote)", fontStyle: "italic" },
    { tag: t.monospace, color: "var(--cm-mono)" },
    { tag: t.list, color: "var(--cm-list)" },
    { tag: t.contentSeparator, color: "var(--cm-sep)" },
    { tag: [t.processingInstruction, t.meta, t.labelName], color: "var(--cm-meta)" },
  ]);

  // ---- Menu "/" (slash commands) ----
  function snippet(text: string, cursor?: number) {
    return (view: EditorView, _c: Completion, from: number, to: number) => {
      const anchor = from + (cursor ?? text.length);
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor } });
    };
  }
  const SLASH: Completion[] = [
    { label: "/h1", detail: "Título 1", apply: "# " },
    { label: "/h2", detail: "Título 2", apply: "## " },
    { label: "/h3", detail: "Título 3", apply: "### " },
    { label: "/todo", detail: "Tarefa", apply: "- [ ] " },
    { label: "/lista", detail: "Lista", apply: "- " },
    { label: "/numerada", detail: "Lista numerada", apply: "1. " },
    { label: "/citação", detail: "Citação", apply: "> " },
    { label: "/divisor", detail: "Linha divisória", apply: "---\n" },
    { label: "/tabela", detail: "Tabela", apply: snippet("| Coluna | Coluna |\n| --- | --- |\n|  |  |\n", 9) },
    { label: "/código", detail: "Bloco de código", apply: snippet("```\n\n```\n", 4) },
    { label: "/callout", detail: "Destaque (callout)", apply: snippet("> [!note] Título\n> conteúdo\n", 10) },
    { label: "/mermaid", detail: "Diagrama Mermaid", apply: snippet("```mermaid\nflowchart TD\n  A[Início] --> B[Fim]\n```\n") },
    { label: "/math", detail: "Equação (LaTeX)", apply: snippet("$$\n\n$$\n", 3) },
    { label: "/tabela-dinâmica", detail: "Tabela por front-matter", apply: snippet("```query\nview: table\nfields: status, prazo\n```\n") },
    { label: "/kanban", detail: "Quadro kanban por status", apply: snippet("```query\nview: board\ngroup: status\n```\n") },
    { label: "/tarefas", detail: "Tarefas do vault agregadas", apply: snippet("```query\nview: tasks\n```\n") },
    { label: "/video", detail: "Revisão de vídeo (timecodes)", apply: snippet("```video\npath: meu-corte.mp4\nfps: 30\n```\n") },
    { label: "/wikilink", detail: "Link interno", apply: snippet("[[]]", 2) },
    { label: "/data", detail: "Data de hoje", apply: new Date().toISOString().slice(0, 10) },
    {
      label: "/cor",
      detail: "Conta-gotas (pegar cor da tela)",
      apply: (view: EditorView, _c: Completion, from: number, to: number) => {
        view.dispatch({ changes: { from, to, insert: "" } });
        pickColor().then((hex) => {
          if (!hex) return;
          const pos = view.state.selection.main.head;
          view.dispatch({ changes: { from: pos, to: pos, insert: hex }, selection: { anchor: pos + hex.length } });
          view.focus();
        });
      },
    },
  ];
  function slashSource(ctx: CompletionContext) {
    const before = ctx.matchBefore(/\/[\wÀ-ÿ]*/);
    if (!before || (before.from === before.to && !ctx.explicit)) return null;
    const prev = before.from > 0 ? ctx.state.sliceDoc(before.from - 1, before.from) : "";
    if (prev && !/\s/.test(prev)) return null; // só no início de palavra
    return { from: before.from, options: SLASH };
  }
  const slashExt = (s: Settings) =>
    s.slashMenu ? autocompletion({ override: [slashSource], icons: false }) : [];

  // ---- Compartments reconfiguráveis pelas Configurações ----
  const fontComp = new Compartment();
  const wrapComp = new Compartment();
  const gutterComp = new Compartment();
  const tabComp = new Compartment();
  const vimComp = new Compartment();
  const slashComp = new Compartment();

  function fontTheme(s: Settings) {
    return EditorView.theme({
      ".cm-scroller": {
        fontFamily: FONT_STACK[s.editorFont],
        fontSize: `${s.fontSize}px`,
        lineHeight: `${s.lineHeight}`,
      },
    });
  }
  const wrapExt = (s: Settings) => (s.wordWrap ? EditorView.lineWrapping : []);
  const gutterExt = (s: Settings) => (s.lineNumbers ? lineNumbers() : []);
  const tabExt = (s: Settings) => [
    EditorState.tabSize.of(s.tabSize),
    indentUnit.of(" ".repeat(s.tabSize)),
  ];
  const vimExt = (s: Settings) => (s.vimMode ? vim() : []);

  function buildExtensions(s: Settings) {
    return [
      vimComp.of(vimExt(s)),
      history(),
      drawSelection(),
      bracketMatching(),
      highlightActiveLine(),
      gutterComp.of(gutterExt(s)),
      wrapComp.of(wrapExt(s)),
      tabComp.of(tabExt(s)),
      slashComp.of(slashExt(s)),
      markdown({ codeLanguages: languages }),
      syntaxHighlighting(lumHighlight),
      wikiPlugin,
      lumTheme,
      fontComp.of(fontTheme(s)),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.domEventHandlers({
        mousedown(e, v) {
          if (!(e.metaKey || e.ctrlKey)) return false;
          const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos == null) return false;
          const line = v.state.doc.lineAt(pos);
          const rel = pos - line.from;
          const re = /\[\[([^\]\n]+)\]\]/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(line.text))) {
            if (rel >= m.index && rel <= m.index + m[0].length) {
              e.preventDefault();
              onOpenWikilink?.(m[1]);
              return true;
            }
          }
          return false;
        },
      }),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        if (u.transactions.some((tr) => tr.annotation(External))) return;
        onChange?.(u.state.doc.toString());
      }),
    ];
  }

  // Cria a view uma vez.
  $effect(() => {
    if (!host) return;
    const initial = untrack(() => doc);
    view = new EditorView({
      doc: initial,
      parent: host,
      extensions: buildExtensions(get(settings)),
    });
    onScroller?.(view.scrollDOM);
    activeEditorView.set(view);
    return () => {
      activeEditorView.set(null);
      view?.destroy();
      view = undefined;
    };
  });

  // Reconfigura quando as Configurações mudam.
  const unsub = settings.subscribe((s) => {
    view?.dispatch({
      effects: [
        fontComp.reconfigure(fontTheme(s)),
        wrapComp.reconfigure(wrapExt(s)),
        gutterComp.reconfigure(gutterExt(s)),
        tabComp.reconfigure(tabExt(s)),
        vimComp.reconfigure(vimExt(s)),
        slashComp.reconfigure(slashExt(s)),
      ],
    });
  });
  onDestroy(unsub);

  // Ao trocar de arquivo, substitui o documento inteiro.
  $effect(() => {
    path;
    const next = untrack(() => doc);
    if (view && view.state.doc.toString() !== next) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
        annotations: External.of(true),
      });
    }
  });
</script>

<div bind:this={host} class="h-full w-full overflow-hidden"></div>
