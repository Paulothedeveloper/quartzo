# Próximas features do Quartzo (desktop) — plano engatado

> Fila de features **planejadas, não iniciadas**. Cada uma é uma release isolada
> (bump 4 lugares → build → instalador no Desktop → commit/push → release). Padrão
> do projeto: `svelte-check` 0 erros + `cargo check` ok; documentar em
> updates.ts + CHANGELOG.md + release. Escrito em 2026-06-27 (base v0.44).

Estado base: Tauri 2 + SvelteKit/Svelte 5 + Rust, pasta `D:\Projetos do Claude\PC -
QUARTZO`, crate `lumina`, repo `Paulothedeveloper/quartzo`. Já existe
`build_query_index` (Rust) que varre `.md`, parseia front-matter→HashMap, tags e
tarefas — base reutilizável para as views.

Ordem sugerida (valor × esforço): **1) Notas órfãs/recentes → 2) Modo foco →
3) Tabela global (Dataview) → 4) Export Pandoc.**

---

## 1. Painel de notas órfãs / recentes  ·  esforço: baixo-médio

**O que é:** um painel (ou seção na barra lateral) com listas úteis de manutenção
do vault:
- **Recentes** — notas modificadas há pouco (por `mtime`).
- **Órfãs** — notas sem **nenhum** link de entrada nem de saída (ilhas).
- (bônus) **Becos sem saída** — só links de entrada; **Sementes** — só de saída.

**Abordagem técnica:**
- Reusar o **grafo** já indexado (`build_graph_index` devolve nós + arestas).
  Órfã = nó com grau 0 (não aparece em nenhuma aresta). Dá pra computar 100% no
  **frontend** a partir de `graphData` (store já existente) — sem Rust novo.
- **Recentes**: precisa de `mtime`. Opções: (a) `read_directory` já traz data? Se
  não, adicionar `modified` ao `FileNode` no Rust (`fs::metadata().modified()`), ou
  (b) comando novo `recent_notes(vault, limit)` que ordena por mtime. **Decisão:**
  preferir (a) — enriquecer `FileNode` com `modified` (útil em vários lugares).
- **UI**: store `orphansOpen`/seção; componente `OrphansPane.svelte` ou abas dentro
  de um "Painel do vault". Itens clicáveis → `openNote`. Feature flag em
  `FEATURE_PLUGINS` (ex.: `vaultPanel`).

**Arquivos:** `commands.rs` (FileNode + modified), `stores/ui.ts`, novo componente,
`Sidebar.svelte` (botão), i18n.
**Decisões p/ Paulo:** painel lateral fixo vs modal? Quais listas mostrar?

---

## 2. Modo foco / zen  ·  esforço: baixo

**O que é:** modo sem distrações — esconde barra lateral, title bar, abas e painéis;
centraliza o editor numa coluna confortável; volta com Esc ou o mesmo atalho.

**Abordagem técnica:**
- Store `zenMode` (boolean) em `ui.ts`. Comando `toggle-zen` (registry + actionMap)
  com atalho (ex.: `Ctrl+Shift+Z` ou `F11`-like) + entrada na paleta.
- No `+page`/layout: quando `zenMode`, aplicar classe `app-zen` no root que **esconde**
  `Sidebar`, `TitleBar`, `EditorTabs` e os asides (CSS `display:none`/largura 0) e
  **centraliza** o editor (`max-width` + `margin:auto`, reaproveitando `readableLineLength`).
- Sair: `Esc` (svelte:window) + o mesmo comando. Mostrar um “respiro” mínimo (um
  botão flutuante discreto pra sair, opcional).
- Persistir? Provavelmente **não** (estado de sessão). Tocar SFX/anim de entrada.

**Arquivos:** `stores/ui.ts`, `commands.ts`, `+page.svelte` (classe + Esc),
`app.css` (`.app-zen` regras), i18n.
**Decisões p/ Paulo:** atalho preferido; esconde as abas também? mantém o título da
nota no topo?

---

## 3. Tabela de propriedades global (estilo Dataview / Bases)  ·  esforço: alto

**O que é:** uma view que **agrega notas do vault inteiro** por front-matter, além
do bloco ` ```query ` atual (que já faz table/board/tasks). Versão "global":
escolher **fonte** (pasta/tag/todas), **colunas** (qualquer propriedade), **filtro**
(`where campo = valor`, operadores), **ordenação**, **agrupamento** — e ver como
**tabela** rica, **kanban** ou **galeria**.

**Abordagem técnica:**
- Já temos `build_query_index` (Rust) + `query.ts` (`parseQueryConfig`,
  `filterNotes`, `buildQueryView`). Estender, não recomeçar:
  - **Operadores no `where`**: hoje `campo=valor`; adicionar `!=`, `>`, `<`,
    `contains`, `exists` (parse em `parseQueryConfig`).
  - **Colunas dinâmicas**: `fields:` já existe; permitir `*` (todas as props vistas)
    e renomear cabeçalhos.
  - **Galeria**: novo `view: gallery` (cards com a 1ª imagem/`cover` do front-matter).
  - **Editar célula inline** (opcional, avançado): escrever de volta no front-matter
    da nota (reusar `frontmatter.ts` applyFm + write_file).
- **"Global" sem precisar de bloco numa nota**: um **painel/aba "Bases"** (modal ou
  view dedicada) que monta a query por UI (dropdowns) e usa o mesmo `buildQueryView`.
  Store `basesOpen`; componente `BasesView.svelte`.
- Persistir "bases" salvas: arquivo `.quartzo/bases.json` (lista de configs nomeadas).

**Arquivos:** `query.ts` (parser+operadores+gallery), `commands.rs` (se precisar de
mais metadados no índice), novo `BasesView.svelte` + store, `frontmatter.ts` (edição
inline), i18n.
**Decisões p/ Paulo:** começar **simples** (operadores + galeria no bloco ```query)
ou já o **painel "Bases" com UI** de montar query? Edição inline de célula entra?

---

## 4. Exportar PDF / Pandoc mais rico  ·  esforço: médio

**O que é:** hoje o export é `window.print()` (PDF do sistema) + HTML standalone.
Com **Pandoc** dá pra exportar **PDF de verdade, DOCX, ODT, etc.** com sumário,
estilos e citações.

**Abordagem técnica:**
- Rust: `pandoc_available()` + `export_pandoc(src_md, dest, format)` via
  `std::process::Command("pandoc")` (com `no_window` no Windows). Passar a nota
  (ou um bundle) por stdin/arquivo temporário; `-o dest.<fmt>`; opções
  (`--toc`, `--standalone`, template). Para PDF, Pandoc precisa de um engine
  (wkhtmltopdf/LaTeX) — **detectar** e, se faltar, cair no `--pdf-engine=wkhtmltopdf`
  ou avisar e usar o print atual como fallback.
- Resolver embeds/wikilinks/imagens antes (gerar um Markdown "achatado": expandir
  `![[ ]]`, converter `[[ ]]`→texto/link, caminhos de imagem absolutos). Reusar a
  lógica de transclusão (`renderEmbedsIn`) só que em Markdown puro.
- UI: em `export.ts` + menu de exportar (já há Printer/HTML) adicionar
  "Exportar com Pandoc…" → escolher formato (dialog) → salvar.
- Capability: o opener/dialog já cobrem; Command de processo já é usado (git/ffmpeg).

**Arquivos:** `commands.rs` (pandoc_available/export_pandoc), `export.ts`, toolbar do
editor + paleta, i18n.
**Decisões p/ Paulo:** exigir Pandoc instalado (e qual engine de PDF)? Quais formatos
expor (PDF, DOCX, ODT)? Exportar **uma nota** ou o **vault/seleção**?

---

## Checklist comum a todas

- Cada feature: setting/feature-flag quando fizer sentido; i18n PT/EN/ES (chaves no
  `i18n-dict.ts`, paridade exata nos 3 blocos); design + SFX/anim + estado vazio.
- Bump em `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
  `SettingsModal.svelte appVersion`.
- `cargo clean` **não** é necessário (já feito na mudança de pasta); buildar de
  `D:\Projetos do Claude\PC - QUARTZO` (Android é que precisa do junction — ver
  `docs/MOBILE-ANDROID.md`).
- Atualizar `docs/GUIA.md` com a feature nova.

> Quando quiser tocar, é só dizer qual (ou "todas, uma a uma") e respondo as
> "Decisões p/ Paulo" de cada — ou sigo com os padrões recomendados.
