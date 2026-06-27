# Changelog — Quartzo

Todas as mudanças relevantes do Quartzo. Formato: mais recente primeiro.
(Regra do projeto: **toda mudança**, pequena ou grande, é registrada aqui, nas Notas de atualização do app, e na release do GitHub.)

## 0.29.0 — 2026-06-26

- **Grafo ainda mais suave (modo leve v2):** (1) arestas **retas** em vez de bezier (geometria muito mais barata); (2) o **rótulo** só entra no DOM quando o nó está **sob o cursor** (antes eram centenas de `<span>` sempre presentes); (3) o hover **não restiliza todas as arestas** (era O(arestas) a cada movimento do mouse) — ficam no estilo base; (4) `transition: none` nos nós (dim instantâneo). Pan/zoom e hover bem mais leves em grafos grandes.

## 0.28.0 — 2026-06-26

- **Grafo travando — correção definitiva:** grafos grandes (>150 nós ou >300 arestas) entram em **modo leve** — desliga `box-shadow`/`radial-gradient`/`backdrop-filter`/`drop-shadow` dos nós e arestas (os efeitos GPU que travavam o pan/zoom), pula a animação de entrada e **congela o layout** (sem física contínua). Cores e formas permanecem, então de longe é quase imperceptível, mas a fluidez melhora muito. Grafos pequenos mantêm a física contínua e todos os efeitos. Combinado com `onlyRenderVisibleElements` e o cache de nós (v0.27).

## 0.27.0 — 2026-06-26

- **Desempenho do grafo (sem mudar o visual):** a aba do grafo estava travando após a física contínua. Otimizações: (1) os objetos `data` de cada nó e os membros de cada pasta são **cacheados** (não recriados a cada tick); (2) os **lobos/regiões** (bbox por pasta, caro) recalculam só **a cada 6 ticks** + no repouso, em vez de todo frame; (3) `onlyRenderVisibleElements` no SvelteFlow — **só renderiza o que está na tela** (nós e arestas fora da viewport são descartados). Resultado: acomodação e arraste bem mais fluidos, mesmo em grafos grandes. Nada do visual mudou.

## 0.26.0 — 2026-06-26

- **Grafo com física contínua:** a simulação roda **ao vivo** — os nós se acomodam suavemente ao abrir e **reagem ao arrastar** (fixa o nó no ponteiro e reaquece a simulação; vizinhos se reorganizam; para sozinha ao estabilizar). Auto-enquadra na 1ª acomodação. Em grafos grandes (>600 nós) o layout é pré-calculado automaticamente. Liga/desliga em **Configurações › Aparência**.
- **Wikilinks por caminho:** `[[pasta/Nota]]` resolve a nota certa mesmo com nomes repetidos em pastas diferentes — no **editor**, no **preview** e nas **arestas do grafo** (Rust `build_graph_index` ganhou mapa por caminho relativo; `resolveWikilink` casa pelo fim do caminho).

## 0.25.0 — 2026-06-26

- **Busca fuzzy** na **Paleta de comandos** (Ctrl+K) e no **“Ir para nota”** (Ctrl+O): casa subsequências (ex.: `cfg` → Configurações, `nta` → Nova nota), **ranqueia por relevância** (bônus de prefixo, início de palavra e letras consecutivas) e **realça** as letras casadas. Helper `src/lib/fuzzy.ts` (fuzzyMatch/highlightParts).

## 0.24.0 — 2026-06-23

- **Editor visual de Propriedades (front-matter):** painel no topo do editor (modo edição/dividido) que lê o bloco YAML `--- … ---` e mostra **campos editáveis** (chave/valor) — adicionar, renomear, remover, sem digitar YAML cru. Edições vão direto pro CodeMirror vivo (mantém undo), listas como `tags` viram `[a, b]` (YAML válido, não-destrutivo). Alimenta as views dinâmicas (tabela/kanban). Liga/desliga em **Configurações › Editor**. Helper `src/lib/frontmatter.ts` (parseFm/serializeFm/applyFm), componente `PropertiesPanel.svelte`, i18n `props.*` PT/EN/ES.

## 0.23.0 — 2026-06-23

- **Proxy de vídeo (ffmpeg):** no bloco ```` ```video ````, formatos que o WebView2 não toca (H.265/ProRes/.mov/.mkv) ganham um botão **Gerar proxy (ffmpeg)** que transcodifica para **H.264 720p** em `.quartzo/proxies/<hash>.mp4` (reaproveitado depois) e troca o player para a versão compatível. Aviso automático quando o formato é arriscado ou falha ao carregar. Backend Rust: `ffmpeg_available`, `make_video_proxy`. Player de revisão de vídeo também traduzido (PT/EN/ES).

## 0.22.0 — 2026-06-23
- **Git v2:** **diff por arquivo** (clique num arquivo alterado no painel de Versões → diff colorido inline, com untracked mostrado como adição inteira); **sincronização com remoto** — botões **Enviar (push)** / **Receber (pull --rebase)** com indicador de **commits à frente/atrás** do upstream; **snapshot automático** opcional (auto-commit a cada N minutos quando há mudanças, ligado no próprio painel). Backend Rust: `git_diff`, `git_remote`, `git_push`, `git_pull`. Settings: `gitAutoSnapshot`, `gitAutoSnapshotMinutes`.

## 0.21.0 — 2026-06-23
- **i18n Fase 3 (parte 1):** a **Paleta de comandos** (Ctrl+K) agora é totalmente traduzida — nomes e dicas de cada comando, e a lista “Ir para: nota”. A **navegação das Configurações** (todas as abas: Geral, Arquivos & Links, Editor, Markdown, Tipos de nota, Aparência, Plugins nativos, Nuvem, Integrações, Atalhos, Atualizações, Tutorial, Sobre) e o título do diálogo passam a seguir o idioma (PT/EN/ES).

## 0.20.0 — 2026-06-22
- **i18n Fase 2:** tradução EN/ES ampliada para a **barra lateral**, **árvore de arquivos**, **abas**, **Outline**, **Backlinks**, estados vazios do editor, **menus de contexto** (arquivos e abas) e placeholders das paletas.

## 0.19.0 — 2026-06-22
- **Atalhos completos:** **todos os comandos** agora são atribuíveis em Configurações › Atalhos, com **busca/filtro**. A **Paleta de comandos** e os atalhos passam a usar o **mesmo registro** — a paleta mostra o atalho de cada comando. Novos comandos: **Nova nota** (Ctrl+N), **Nova pasta**, **Fechar aba** (Ctrl+W), **Paleta** (Ctrl+K).
- **Marco:** Configurações no nível do Obsidian concluídas — Editor, Arquivos & Links, Aparência, Plugins nativos, Espiar página e Atalhos.

## 0.18.0 — 2026-06-22
- **Configurações › Plugins nativos** (nova aba, estilo Obsidian): ligue/desligue recursos do Quartzo — **Grafo, Canvas, Rascunho, Versões (Git), Nota do dia, Memórias do Claude e Painel de tags**.

## 0.17.0 — 2026-06-22
- **Espiar página (hover preview):** passe o mouse sobre um `[[wikilink]]` (no editor ou na leitura) e veja um **cartão com a pré-visualização** da nota destino. Opção de **exigir Ctrl** em Configurações › Editor.

## 0.16.0 — 2026-06-22
- **Configurações › Arquivos & Links** (nova aba, estilo Obsidian): **local padrão para novas notas** (raiz do vault ou pasta da nota atual); **confirmar antes de excluir** (diálogo ao mover para a lixeira); **reconstruir cache do vault** (reindexa grafo, views por front-matter e árvore).

## 0.15.0 — 2026-06-22
- **Configurações › Editor (estilo Obsidian):** **margens de tamanho confortável** (largura legível) no editor e na leitura; **criação em pares de símbolos** (parênteses/aspas/**/_); **verificação ortográfica**; **direita para esquerda (RTL)**; opção de **mostrar/ocultar o status do editor**.

## 0.14.0 — 2026-06-22
- **Menu do vault** (clique direito no nome do vault): **Mostrar na pasta** e **Copiar caminho** — igual ao Obsidian.
- **Aparência:** **cor de destaque** personalizável (paleta cristal + seletor de cor livre), **zoom global** do app e **tamanho da fonte da interface** ajustáveis.
- Início do épico **Configurações no nível do Obsidian** (mais ondas a caminho: Editor, Arquivos & Links, Atalhos completos, Plugins como toggles, hover preview).

## 0.13.0 — 2026-06-22
- **Grafo — regiões clicáveis (cérebro / cristal):** cada pasta agora forma um **lobo colorido e rotulado**; clicar no lobo **mergulha (zoom) naquela região** do mapa, acende suas conexões e esmaece o resto. Botão **"Ver tudo"** para voltar; o seletor de pasta também dá zoom.
- **Grafo — rótulo limpo:** ao passar o mouse aparece **apenas o nome do nó sob o cursor**, num cartão flutuante elegante (acabou a sobreposição de textos pequenos que poluía a visão).
- **Idiomas (i18n):** Português, **English** e **Español** — Configurações › Geral › Idioma, com detecção automática pelo idioma do sistema. (Cobertura inicial da interface; ampliando a cada versão.)

## 0.12.0 — 2026-06-22
- **Polimento (lote 1):** realce de código no **tema claro** + muitas linguagens novas; **atalhos editáveis** (Configurações › Atalhos); **persistência de abas** (restaura a sessão do vault); **preview mais leve** (debounce de Mermaid/views/math) + **cache de backlinks**; **Templates** antigos unificados nos **Tipos de nota**.

## 0.11.0 — 2026-06-22
- **Grafo estilo cérebro:** os nós viraram **neurônios** (pontos com glow, cor por pasta) ligados por **sinapses curvas** (bezier finas e luminosas). Os rótulos ficam ocultos e aparecem ao passar o mouse — visual limpo, sem fontes grandes.
- **Código aberto:** repositório público no GitHub. Uso **pessoal e gratuito — não à venda** (ver LICENSE). Privacidade local-first reforçada no README.

## 0.10.0 — 2026-06-22
- **Criação de notas — ferramentas completas:** barra de formatação no editor (negrito, itálico, tachado, títulos, listas, lista numerada, tarefas, citação, link, imagem, tabela, bloco de código, callout, divisor). Liberdade total para montar a nota como quiser, somada ao menu `/` e aos Tipos de nota.
- **Integração com o PRISMA** (app de biblioteca de mídia do mesmo autor): Configurações › Integrações — abrir o PRISMA e usar este vault como **Base de Conhecimento** dele. Fluxo do ecossistema: **Quartzo (notas) → PRISMA (assets + RAG) → DaVinci Resolve (FCPXML + plano de cor citando suas notas)**. Integração de menor atrito por **pasta de vault compartilhada** (o PRISMA reindexa ao vivo); evolução futura prevista: deep link `prisma://`.
- **Grafo:** nós (cristais) e rótulos menores, no tamanho dos ícones do Obsidian.
- **Tutorial** atualizado (criação de notas + ecossistema PRISMA).

## 0.9.1 — 2026-06-22
- Editor visual de **Tipos de nota** nas Configurações (criar/editar/excluir/restaurar; sem mexer em JSON).

## 0.9.0 — 2026-06-22
- **Rascunho**: quadro de desenho à mão livre (Ctrl+Shift+D) com `perfect-freehand` — caneta (cores/espessura), borracha, desfazer, limpar, exportar SVG, auto-salvar.

## 0.8.1 — 2026-06-22
- **Tipos de nota**: criar notas com front-matter pronto (projeto, cliente, reunião, snippet…), via + Adicionar → Nova de tipo… (editáveis em `.quartzo/types.json`).

## 0.8.0 — 2026-06-22
- **Nuvem**: sincronizar o vault pela pasta do Google Drive/OneDrive (detecção + mover vault, com backup do original).

## 0.7.1 — 2026-06-22
- **Exportar nota**: Imprimir/Salvar como PDF + Exportar HTML autônomo.

## 0.7.0 — 2026-06-21
- **Git nativo**: painel Versões (Ctrl+Shift+G) — iniciar versionamento, salvar versões, histórico (usa o git do sistema, local).

## 0.6.0–0.6.3 — 2026-06-21
- **Revisão de vídeo** time-coded (bloco ```video): player local, marcar timecode, timecodes clicáveis, exportar marcadores (CSV).
- **Moodboard no Canvas**: colar/arrastar imagens, redimensionar, cartão de cor (conta-gotas), organizar em grade.
- **Animação de entrada** em todas as views/painéis/listas; **barra lateral redimensionável**.
- Correções no grafo (troca de vault, nós, remoção do minimapa).

## 0.5.0–0.5.1 — 2026-06-21
- **Views dinâmicas por front-matter** (bloco ```query): tabela, kanban (por status), lista e **tarefas agregadas** (checkbox marca no arquivo).
- **Cor**: conta-gotas global (eyedropper) + extração de paleta de imagem.

## 0.4.0–0.4.1 — 2026-06-21
- **Onda técnica**: Mermaid, KaTeX (math), blocos de código com copiar/linguagem/nº de linha, cor inline (`#hex`), menu `/`, "buscar = criar" no quick switcher.
- **Barra de topo** estilo Apple (semáforo, busca central, + Adicionar) + always-on-top.

## 0.3.x — 2026-06-21
- Tema claro, SFX (efeitos sonoros), animações; correções de navegação/grafo; vault list (troca rápida de vaults).

## 0.1.x–0.2.x — 2026-06-20/21
- Base: editor CodeMirror + preview premium (callouts, tabelas, código), wikilinks/backlinks + menções não-linkadas, grafo, Canvas, busca global, tags, daily notes, templates, outline, memórias, instalador, atualizações + tutorial no app.
