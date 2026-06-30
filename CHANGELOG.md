# Changelog — Quartzo

Todas as mudanças relevantes do Quartzo. Formato: mais recente primeiro.
(Regra do projeto: **toda mudança**, pequena ou grande, é registrada aqui, nas Notas de atualização do app, e na release do GitHub.)

## 0.64.1 — 2026-06-30

- **FIX: a miniatura da nota do grafo não abria.** Diagnóstico: o picking + `onNodePick` sempre funcionaram (provado por HUD instrumentado: `near=3px`, callback dispara), mas o popover `GraphNotePeek` (`position:fixed`) vivia dentro de um container da view do grafo com `transform`/`overflow`, que quebrava o fixed e/ou recortava o popover → "abria mas não aparecia". Correção: **portar a miniatura pro `document.body`** (`use:portal`), renderizar imediatamente (removido o gate `placed`), `z-index: 2000` e borda ciano + animação de entrada (spring). Validado pelo Paulo no app real.
- Processo de teste passou a ser **limpo**: desinstala (NSIS `/S`) → instala do zero → abre. E o fechamento do app virou **graceful** (WM_CLOSE) em vez de `Stop-Process -Force` — o force-kill corrompia o GPUCache do WebView2 e causava tela preta/branca (registrado no Manual do PC do Paulo).

## 0.64.0 — 2026-06-30

Onda de redesign premium (autônoma, após pesquisa de concorrência + leitura do Manual). O fundo de nebulosa procedural da 0.63 (rejeitado pelo Paulo) foi **substituído pela GALÁXIA WebGL**.

- **Grafo = GALÁXIA WebGL/Three.js** (`Graph3D.svelte`, novo): nós-neurônio luminosos (sprites aditivos + `UnrealBloomPass`), sinapses rosa, nebulosas (sprites coloridos ao fundo) e campo de 1400 estrelas. Layout 3D **congelado** (`d3-force-3d` roda N ticks e para — sem física ao vivo, seguro pra térmica). `autoRotate` ambiente que **para na 1ª interação** (o nó não foge do clique).
- **Clique do nó → miniatura interativa** (`GraphNotePeek.svelte`, novo): popover rolável + arrastável (barra de título) + redimensionável (`resize:both`) + botões abrir/tela-cheia/fechar. **Picking em espaço de tela** (projeta cada nó pra 2D, raio de acerto 38px) — o raycaster de Sprite ignora threshold, então com nós pequenos o acerto virava pixel-perfect; resolvido. **Causa do "clique não abria" diagnosticada com HUD** (medição, não achismo): o picking sempre funcionou (`near=3px`, `onNodePick` disparava) — o que falhava era o auto-giro afastar a bolinha; corrigido com pausa-na-interação + raio maior. Hover acende o nó e pausa o giro.
- **Grafo não PISCA mais no sync (Google Drive):** o watcher reindexava zerando o grafo (`graphData.set(null)`) a cada evento de arquivo → loop. Agora reindexa **em segundo plano** (mantém o grafo na tela), só se os dados mudaram (assinatura), no máximo **1x/4s** (throttle pra não martelar CPU). Overlay de "indexando" só no 1º load.
- **TEXTO NUNCA MAIS ESCONDIDO** (dor #1 do Paulo): tooltip automático global — listener delegado detecta qualquer elemento truncado (`scrollWidth>clientWidth`) e injeta o texto completo como `title` (cobre abas, árvore, favoritos, git, settings, modais, mobile, e futuros). + `title`/`min-w-0` explícitos em abas/árvore/sidebar. + `overflow-wrap`/`text-wrap: balance|pretty` global no conteúdo (`.q-prose`) e `[data-textsafe]`.
- **Fonte Inter EMBUTIDA** (`@fontsource-variable/inter`): antes caía no Segoe UI do Windows. Token `--font-sans` atualizado.
- **Fim da TELA BRANCA** ao minimizar/restaurar/trocar foco: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-features=CalculateNativeWinOcclusion` no `lib.rs` (Windows).
- **Fundação de motion premium:** tokens `--ease-spring`/`--ease-expo`/`--dur-fast|base|slow`; guard global `@media (prefers-reduced-motion: reduce)` (respeita o SO, além do toggle no-anim).
- Validação por **medição** (`getBoundingClientRect`, regra do Manual — o screenshot do WebView2 via PrintWindow mente pra layout): welcome medido sem overflow (content 577..1077 em viewport 1280).

## 0.63.0 — 2026-06-29

- **Grafo no ESPAÇO (caminho escolhido pelo Paulo após pesquisa de referências):** a saga passou por recolor (rejeitado: "só mudando a cor") → redesign de gemas hexagonais + lattice (rejeitado em uso: facetas viraram linhas cruzando a tela) → Paulo pediu "muda só a cor, mantém os balões de pasta, remove essas linhas" e depois "fundo com aspecto de espaço: universo, estrela, gradiente, nebulosa". Pesquisei o estado da arte (Obsidian *Galaxy View*/*Akasha*/renderer 3D do D'Arcy Norman usam galáxia com bloom + nebulosa, mas em WebGL/Three.js — pesado demais pro PC do Paulo c/ térmica) e recomendei o **caminho 2D estático/GPU** (aprovado):
  - **Fundo de espaço** (`GraphCanvas .graph-space`): gradiente de cosmos no `.graph-wrap` + **nebulosa PROCEDURAL** (`feTurbulence type="fractalNoise"` baseFrequency 0.012/0.03, `feColorMatrix saturate 0`) em 2 camadas com `mix-blend-mode: overlay/screen` sobre zonas de cor (`.nebcolor`) → nuvem de gás estilo Hubble, **renderizada 1x** (estática). **Campo de estrelas** (`.starfield`, 140 círculos SVG determinísticos, ~32% com twinkle). Fontes: [Codrops feTurbulence], [MDN], [Obsidian Galaxy View], [Akasha].
  - **Nós = neurônios redondos rosa/magenta** (`GraphNode .neuron`: núcleo branco-quente → `#d946ef`, glow rosa; halo da cor da pasta no `::after`). **Sinapses curvas** (`SynapseEdge` voltou a `getBezierPath`) com cometas branco-rosa. **Facetas/linhas removidas** (eram o que o Paulo odiou).
  - **Balões de pasta mantidos** (`RegionNode`) + **bloom de cluster** (`.region::before`, glow branco-quente atrás do aglomerado — os clusters "acendem", como nos renderizadores de galáxia).
  - **Perf:** nebulosa estática (feTurbulence 1x), estrelas estáticas (twinkle só num subconjunto), tudo composição GPU; modo leve (vault grande) congela drift/twinkle. Layout segue CONGELADO (regra `simulacao-ao-vivo-congele-o-layout`).
  - Validado: neurônios redondos + sem-linhas no app REAL instalado (PrintWindow); fundo espacial (nebulosa procedural + bloom) em mock headless fiel ao CSS — previews no vault do projeto.

## 0.62.0 — 2026-06-29

- **Grafo — redesign que REALMENTE aparece (a 0.61 era sutil demais):** a causa de "continua igual" era o **modo leve** (liga acima de 120 nós / 250 links), que sobrescrevia os nós com cor-de-pasta chapada e desligava o glow — então em vault grande (caso do Paulo, 179 notas) nada do redesign aparecia. Corrigido:
  - **Nós = células cyan branco-quentes** (núcleo branco → cyan → escuro) com glow, INCLUSIVE no modo leve (glow estático, barato). A cor da pasta saiu dos nós e ficou só nos **lobos**.
  - **Facetas do cristal mais fortes** (fill-opacity ~2,3× + stroke 0.30) — agora claramente visíveis cruzando o canvas.
  - Hover/focus em cyan.
- **Nova opção "Qualidade total no grafo" (exceção pedida pelo Paulo):** `graphFullQuality` (Configurações > Aparência, card do Grafo). Quando ligada, FORÇA `liteMode=false` mesmo em vault grande → neurônios animados (respiração + halo) + facetas vivas. `GraphCanvas` rebuilda ao alternar (o `data.lite` é definido no build). i18n 5 idiomas. Default off (pan/zoom liso em vault grande).
- Validado no `tauri dev` com o vault do Manual (179 notas, modo leve): aglomerado cyan + facetas fortes (preview no vault do projeto).

## 0.61.0 — 2026-06-29

- **Grafo redesenhado pra identidade cristal+neurônios (pedido do Paulo: "tudo novo na aba de garfo"):** mantive o MOTOR (SvelteFlow + d3-force com **layout congelado** — a otimização que matou o lag, regra `simulacao-ao-vivo-congele-o-layout`) e reescrevi o VISUAL pra virar a "rede neural dentro do cristal" do ícone novo:
  - **Paleta restrita à família do cristal** (`GraphCanvas` PALETTE): cyan → teal → azul → violeta → magenta. Saíram verde/âmbar/vermelho quentes (o arco-íris que destoava do ícone). Mantém distinção de pastas, mas tudo lê como neural/cristal. Fallback frio.
  - **Neurônios branco-quentes** (`GraphNode .neuron`): núcleo branco → cor da pasta → escuro, com bloom mais forte (espelha os nós acesos do ícone).
  - **Atmosfera cristalina** (`GraphCanvas`): fundo `#0a0e1a` (igual ao ícone) + poeira fina (Background dots cyan sutil) + glow cyan no topo / refração violeta embaixo + facho diagonal de prisma + vinheta nas bordas (sensação de estar DENTRO da pedra). `no-anim` simplifica.
  - Sinapses seguem curvas (bezier) com **cometas** fluindo (já era). Lobos de pasta herdam a paleta fria.
- Regra cumprida: redesign de visual reusa o motor que funciona (não reescrevi a física/perf), só a camada estética; validado vendo no aparelho.

## 0.60.0 — 2026-06-29

- **Ícone + logo novos (cristal + neurônios):** o ícone foi refeito (processo: reli as regras de marca/vault do Manual, busquei referências reais, gerei conceitos via Pollinations e o Paulo escolheu o cristal com a rede neural acesa por dentro — amarra com o grafo do app). **Variação app vs PC** (pedido do Paulo): desktop usa o render rico e detalhado (`tauri icon` a partir do master V1); o **adaptive do Android** usa uma versão mais bold (`mob_555`) com poucos nós grandes que continuam legíveis em tamanho pequeno (foreground + cor de fundo `#0a0e1a` casada com a borda). Cascata aplicada: `src-tauri/icons/*` (desktop/ios), `gen/android/.../res/mipmap-*` (legacy + adaptive), `static/favicon.png` e `static/quartzo-crystal.png` (hero in-app via `CrystalIllustration`). Validei cada peça renderizando (círculo/squircle/pequeno), não confiando no "salvou". Kit salvo no vault.
- **Drive no CELULAR (sincronia de nuvem):** conectar conta Google (OAuth por **deep link** — Custom Tab volta pro app via scheme reverso do Client ID Android) e **baixar um vault** da pasta do Google Drive direto pro app. Em modo teste aparece "app não verificado → Avançado → Acessar" (escopo `drive.readonly`). Client Android criado (SHA-1 do release), intent-filter no `AndroidManifest`, fluxo no front + Rust emitindo o redirect.
- **Aba Nuvem no celular limpa:** o conteúdo que era só de PC (salvar todos/git, "este vault já está na nuvem", "instale o Drive Desktop", e o card de intro de sincronia) agora é `{#if !isMobile}` — no celular a aba mostra só **"Baixar vault do Drive"**.

## 0.59.3 — 2026-06-29

- **Toolbars com flex-wrap (regra do Manual `barra-de-controles-quebrar`):** as barras de Canvas/Rascunho (`.q-tooltop`) e a de formatação do editor mobile (`.me-fmt`) usavam `overflow-x:auto` (scroll horizontal — que o Paulo já reprovou). Trocado por `flex-wrap:wrap` + `min-height`/altura automática → quebram pra 2ª linha quando não cabem, sem scroll nem corte, em qualquer largura. Reli o Manual antes (regra: reler antes de mudar) e corrigi minha própria implementação da 0.59.1.

## 0.59.2 — 2026-06-29

- **Grafo — mais "motion effect" (pesquisa de refs de rede neural):** `SynapseEdge` agora é um **cometa com cauda** (cabeça `#eafdff` brilhante + 2 dots de rastro com opacidade decrescente e fase atrasada, todos com easing spline) fluindo pela curva bezier. `GraphNode` ganhou um **halo de glow pulsando** (`::after` anel radial, `opacity`+`scale` em loop, fase/ritmo por índice = GPU, barato) — a "pulsação de luz" das sinapses. Refs: animações de neural network (Envato/motion) + técnica de fluxo SVG (Visual Cinnamon).

## 0.59.1 — 2026-06-29

- **Grafo VIVO (a cara das primeiras versões, sem lag):** os neurônios voltaram a se mover — agora **RESPIRAM** (propriedade CSS `scale` pulsando em `GraphNode`, fase/ritmo por índice; compõe com o `transform` do hover, mantém o nó centrado na aresta = sem desconectar, GPU = sem lag). Substitui a física ao vivo que dava o movimento original mas travava. Arestas com impulso ficaram mais VIVAS (traço cyan mais claro/grosso, estável). **Lição registrada no Manual** ([[visual-que-o-usuario-amava-pegue-a-referencia-antes]]): eu vinha iterando no escuro; o certo é pegar a referência da versão amada antes de mexer.
- **Grafo mais fluido (motion design):** removido o timer que rotacionava os impulsos e **reconstruía TODO o array de arestas a cada 1,6s** — isso recriava os elementos SMIL e reiniciava todos os cometas juntos (o "engasgo/animalesco"). Agora o pulso é **estável por aresta** (definido no build, cap ~120 cometas em vaults grandes), o cometa tem **easing** (`calcMode="spline"`: glide ease-in-out na posição + fade suave na opacidade/raio), **mais lento** (2.0–3.7s) e **fases espalhadas** (0–4s) → fluxo contínuo e orgânico, sem rebuild periódico. `SynapseEdge` sempre bezier.
- **Android — botão Voltar:** `MobileShell` agora intercepta o back (truque de `history.pushState` + `popstate`) e fecha as camadas em ordem (sheet → modais → gaveta → canvas/sketch → editor → aba≠Início) antes de sair; só sai do app na tela inicial (`getCurrentWindow().close()`).
- **Grafo — colisão do rótulo:** o nome da pasta (`RegionNode`) estava centralizado ATRÁS do aglomerado de nós; ancorado no topo da região (`justify-content:flex-start; padding-top:13%`) — sem mais texto sobre os nós.
- **Idioma — emoji removido (regra do Manual `nunca-emoji-ui-producao`):** tiradas as bandeiras do seletor (`LOCALES` sem `flag`); só texto, em `grid grid-cols-3` (não estoura mais a largura).

## 0.59.0 — 2026-06-29

**Redesign mobile (Obsidian UX + acabamento BW Hair/Ludex + identidade Quartzo)** + **grafo orgânico de volta**.

Mobile (tudo sob `isMobile`, desktop intacto):
- **Gaveta lateral** (`MobileDrawer`) = árvore de pastas como navegação principal (reusa `MobileNoteList`); abre por toque ou **swipe da borda esquerda**; rodapé com nova nota + abrir/gerenciar vault + configurações.
- **Barra inferior flutuante em pílula** (`.m-glass`: blur+saturate + borda interna 1px + inner shadow) com **bolha cyan + glow** na aba ativa (Início/Buscar/Grafo/Mais).
- **Tela inicial** (`MobileHome`): cristal + tagline + ações-pílula (Nova nota / Buscar / Nota do dia) + **recentes** (via `vault_insights`).
- **Configurações = lista agrupada drill-down** (toca seção → subtela via `MobileScreen`), no lugar das abas horizontais.
- **Folha de ações no +** (`BottomSheet`): nova nota, nota do dia, memória, canvas, rascunho.
- **Acabamento** (tokens em `app.css`): `--m-ease` cubic-bezier(0.22,1,0.36,1), `.m-press` (scale 0.96), `.m-row-in` (stagger), `.m-glass`, `--m-glow`. Aplicado em home, gaveta, pílula, Mais, Settings, árvore.

Grafo (desktop + app, `GraphCanvas`/`SynapseEdge`):
- **Conexões SEMPRE bezier (curvas)** — removido o `straight` do modo leve (neurônio não liga por reta).
- **Impulsos sinápticos SEMPRE ligados** (~16 por vez, revezando; SMIL fora da thread) — não dependem mais do tamanho do vault.
- **Glow nas arestas que disparam** mesmo em vaults grandes (custo é por-aresta-acesa, ~16, não por-aresta-total).
- A otimização que resolveu o travamento (layout **congelado**, `sim.stop()`) foi mantida — era a física ao vivo que pesava, não o visual.

## 0.58.0 — 2026-06-29

**Mobile 100% nativo** — o Paulo apontou que ainda existiam abas que eram só o desktop embrulhado com CSS (`html.mobile .qmodal-panel{inset:0}`, `qsettings-*`, `gv-*` escondendo coisas com `display:none`). Refeitas como telas nativas de verdade, com o **mesmo conteúdo** e **casca de navegação própria** (padrão: corpo em `{#snippet}` reusado nas duas cascas via `{#if isMobile}{:else}` — desktop intacto).

- **`MobileScreen.svelte` (novo):** casca nativa reutilizável — header (voltar + título + ícone + ações), `subbar` opcional (tira de abas), `footer` opcional, body com scroll e safe-areas.
- **Configurações:** header nativo + **abas horizontais roláveis** (13 seções reusadas via snippet `sectionBody` + `navTabs`), sem o rail lateral espremido por CSS.
- **Bases, Órfãs/Recentes, Notas duplicadas, Nova Memória, Gerenciar vaults:** cada uma vira tela cheia nativa (corpo reusado; o render de DOM ao vivo do Bases e as abas do Insights funcionam dentro da casca nativa).
- **Grafo (mobile):** toolbar nativa dedicada (cabeçalho + busca + filtro + reindexar) — fim da "aba grafo bugada"; o botão de reindexar não fica mais cortado.
- **Nova Memória:** botão **Salvar no topo** (alcançável com o teclado aberto — o edge-to-edge do Tauri não repassa o inset do teclado).
- **Canvas e Rascunho:** barra de ferramentas com **safe-area** (desce abaixo da status bar do Android) + scroll horizontal.
- **Limpeza:** removidos os remendos `html.mobile` (`qmodal-panel` fullscreen, `qsettings-*`, `gv-*`); diálogos pequenos (confirmar/renomear) voltaram a ser cartões centrados. **Validado no emulador Android, tela por tela** (Settings, Bases, Insights, Duplicatas, Vaults, Memória, Grafo, Editor, Buscar) + troca de idioma pt/fr/de.

## 0.57.1 — 2026-06-29

Correções pegas **testando no emulador Android real** + no app desktop:

- **Android — barra de formatação do editor:** ficava **escondida atrás do teclado** (o edge-to-edge do Tauri não repassa o inset do teclado pro WebView — nem `adjustResize`, `visualViewport` ou `interactive-widget` resolvem porque o WebView não "vê" o teclado). Solução robusta: a barra agora é **fixa no topo da nota** (sempre visível, rola na horizontal), independente do teclado. Validado no emulador.
- **Lista de notas vazia** mostrava `"Grafo vazio"` (chave i18n errada) → nova chave `mobile.emptyNotes` ("Nenhuma nota ainda. Toque em + para criar.") nos 5 idiomas.
- **Desktop — arrastar pra reordenar:** funcionava no navegador mas não no app porque o Tauri intercepta o DnD HTML5 (`dragDropEnabled:true`). Setado `dragDropEnabled:false` no `tauri.conf.json` (também faz o drop de imagem no Canvas usar o evento web padrão). Ver lição no Manual.

## 0.57.0 — 2026-06-28

- **Grafo — impulsos sinápticos (energia viajando pelas arestas):** novo custom edge `SynapseEdge` desenha, além do traço, um **impulso de luz** que viaja do nó de origem pro de destino via **SVG `animateMotion` (SMIL)** — animado pelo browser, fora da thread principal. **Anti-lag (a parte crítica):** só **~12-14 arestas pulsam por vez**, revezando a cada **~1.9s** (timer de baixa frequência); as demais ficam estáticas (zero repaint). Layout segue **congelado**. Duração/fase variam por hash do id (não sincronizam). Desliga no **modo leve** (grafos grandes) e com **"reduzir animações"** (`html.no-anim`). Medido (headless/software): **FPS ocioso COM os impulsos = 60** — não voltou ao loop. Visual base preservado.
- **i18n — 5 idiomas:** adicionados **fr-FR** e **de-DE** (dicionário completo, **paridade exata de 622 chaves** com os demais). `Locale`/`LOCALES`/`detect()` atualizados. Agora: pt · en · es · fr · de.
- **Mobile nativo (F1–F4):** `MobileNoteList` (navegação **drill-down** por pastas + **long-press → BottomSheet** de ações; cancela ao rolar), `MobileEditor` (casca própria + **barra de formatação acima do teclado** via `visualViewport`, com safe-area), `MobileSearch` (busca **full-screen** reusando `search_notes`), e **modais em tela cheia no mobile** (Configurações/Bases/Insights/Duplicadas/Memória) com a nav do Settings virando **abas no topo** (`qmodal-*`/`qsettings-*` + regras `html.mobile`). Reusa o conteúdo (CodeMirror/preview), casca de navegação própria — não é o desktop espremido.
- **Explorador — ordenar/reordenar tópicos:** store `explorerSort` com modos **A→Z / Z→A / Aleatório / Manual** (persistido por vault) + **arrastar pra reposicionar** no modo manual (HTML5 DnD, ordem salva). Botão de ordenação no cabeçalho da lista. i18n `sort.*` nos 5 idiomas.

## 0.56.0 — 2026-06-28

- **App mobile nativo (Fase A) — `MobileShell.svelte`:** no Android/iOS o `+page` renderiza a `MobileShell` no lugar do layout desktop (mesma lógica/stores/Rust). **Barra de abas inferior** (Notas/Buscar/Grafo/Mais), **lista de notas** com busca por nome (FileTree), **editor em tela cheia** ao tocar a nota (barra com voltar + nome; toolbar do desktop escondida via `html.mobile`), **FAB (+)** pra nova nota (posicionado acima da barra), aba **Grafo** (touch) e **Mais** (Nota do dia, Memória, Canvas, Rascunho, Bases, Órfãs, Duplicadas, Criar/Abrir/Gerenciar vault, Tutorial, Configurações). Tutorial com cópia mobile (`tutm.*`). i18n `mobile.*`. Não é mais o desktop em 9:16.
- **Grafo — travamento eliminado (a causa real):** a física do d3 rodava **ao vivo, sem nunca parar** — reconciliava ~100 nós pelo SvelteFlow ~60×/s indefinidamente (FPS ocioso medido em **~13**, mesmo parado, sem interação; em máquina com throttle térmico vira lag permanente). Agora o layout é **sempre pré-computado e CONGELADO**: roda os ticks uma vez (em lotes via `requestAnimationFrame` em vaults grandes, pra não travar a thread) e **para de vez** (`sim.stop()`), sem loop de repaint. A física só **reaquece de leve ao arrastar** um nó (se ligado em Configurações) e esfria/para sozinha ao soltar; sem reaquecimento, o nó arrastado acompanha o ponteiro na hora. Medições headless (render por software): **ocioso 13→61 fps, pan 11→49, abrir 12→48** — em GPU real trava em 60. **Glow das arestas** (filtro SVG) deixou de ser aplicado nas ~165 de uma vez (re-rasterizava a cada frame) e fica só nas **destacadas**; viewport com `will-change:transform` (pan vira translate na GPU). **Culling** liga >350 nós e `liteMode` em >120 nós / >250 arestas. **Visual idêntico** — validado por screenshot. A opção "Física ao arrastar nós" descreve o novo comportamento (PT/EN/ES).
- **Menu de vaults:** cada vault mostra o **caminho** (segunda linha via `CtxMenuItem.sub`) — distingue homônimos (ex.: `D:\VAULTS` vs `G:\Meu Drive\VAULTS`); store **`recentVaults`** reativa + **reabre o menu** após remover/renomear (a lista atualiza na hora); `normVault` com `trim`.
- **Salvar todos os vaults na nuvem:** `saveAllVaultsToCloud()` (git-auto) percorre os vaults, faz commit + push em cada repo com remoto; botão em Configurações › Nuvem (desktop). i18n `set.saveAll*`.
- **Ícone Android:** `tauri icon` regenerou os mipmaps com a logo de cristal.

## 0.55.0 — 2026-06-27

- **Criar vault (faltava!):** `createVault()` em vault-actions — `askPrompt` do nome + (desktop) diálogo de pasta-pai / (mobile) `appLocalDataDir` → `ensure_dir` (Rust, novo) → `setVault`. Botões na **WelcomeScreen** (Criar + Abrir), no **menu de vaults** (Sidebar) e comando `new-vault` na paleta. i18n PT/EN/ES.
- **Tutorial de 1ª abertura:** `TutorialOverlay.svelte` (store `tutorialOpen`) — tour de 8 passos reaproveitando `tut.step1..8` (no mobile pula o passo 8 = PRISMA). Abre sozinho na 1ª vez (flag `quartzo:tutorialDone`), navegável (setas/dots/Esc), reabre pelo comando `show-tutorial`. Sem emoji (regra do Manual); ícones lucide.
- **Tela de entrada responsiva:** `h1` com `clamp` + `line-height 1.18` (degradê não corta descendentes), `.welcome` com `overflow:auto`, media queries escalam o cristal em alturas ≤760/560, safe-area no conteúdo.
- **Android utilizável:** vault no app-storage (`openMobileVault`/`ensure_dir`), sidebar vira gaveta (`mobileNavOpen` + hambúrguer), semáforo/voltar-avançar/resizer escondidos, safe-area (Android 15). `platform.ts` (isMobile). Release inclui **APK + AAB assinados**.

## 0.54.0 — 2026-06-27

- **Documento premium (PDF + HTML):** reescrita do `EXPORT_CSS` com visual editorial — **corpo serifado** (Iowan/Palatino/Georgia) + **títulos sans** (Inter), **letterhead** ("✦ Quartzo" + data) e **rodapé** discreto (nome da nota · Quartzo) injetados no `standaloneDoc`, **H1** com régua em **degradê** teal→ciano, H2 com hairline, **tabelas estilo revista** (cabeçalho em caps/tracking, filetes finos, sem bordas externas), citações com barra ciano + leve fundo, código em cartão suave, `hr` como **✦** centralizado, imagens arredondadas com hairline, `print-color-adjust:exact` + `page-break-inside:avoid` em pre/tabela/img/callout. Vale igual pro PDF (impressão) e pro export HTML. Validado por render no navegador.

## 0.53.0 — 2026-06-27

- **Impressão/PDF refeita (documento isolado):** o `printNote` antigo usava `body.q-printing .q-prose { position:absolute; inset:0 }` — o `.q-prose` se posicionava dentro da **coluna do editor**, então o PDF saía com o conteúdo deslocado pra direita e o título do webview ("Tauri + SvelteKit…"). Agora `printNote` monta um **documento HTML autônomo** (mesmo `standaloneDoc`/`EXPORT_CSS` do export HTML, reusado), injeta num **iframe oculto**, define `title` = nome da nota e chama `print()` ali — **sem o layout do app vazar**, texto ocupando a página inteira, com `@page { margin:16mm }`. Removido o bloco morto `@media print .q-printing` do app.css. `exportNoteHtml` também passou a reusar `standaloneDoc`. Toast "abra em Leitura/Dividido" virou i18n `export.openReadingFirst` PT/EN/ES. (Cabeçalho/rodapé extra do diálogo de impressão é controle do sistema — desligável em "Cabeçalhos e rodapés".)

## 0.52.0 — 2026-06-27

- **Export DOCX nativo (sem ferramentas externas) — substitui o Pandoc:** a pedido (tudo tem que ser do próprio app), removi a dependência do **Pandoc** e escrevi um **gerador de DOCX em Rust** (`src-tauri/src/docx.rs`) usando `pulldown-cmark` (parser) + `zip` (empacotamento OOXML) — **libs compiladas no binário, nada que o usuário instale**. `export_docx(vault, note_path, dest)` achata a nota (reusa `expand_md`/`strip_frontmatter`) e gera o `.docx` com: títulos (estilos Heading1–6), **negrito/itálico/riscado**, `código` inline + blocos de código (Consolas+shading), listas (numeradas/marcadores com indentação), **tabelas** com bordas, citações (estilo Quote), regras horizontais e **imagens embutidas** (detecção de dimensão PNG/JPEG/GIF → EMU, com `word/media` + rels + content-types). `export.ts` agora tem `exportDocx` (diálogo .docx); comando `export-doc` = "Exportar como Word (.docx)". Removidos `pandoc_available`/`export_pandoc`. Teste `cargo test` valida o pacote (partes OOXML, XML balanceado, título/tabela/negrito/mono). i18n `export.docx*` PT/EN/ES. **PDF** segue pela impressão do sistema e **HTML** pelo export nativo.

## 0.51.0 — 2026-06-27

- **Exportar com Pandoc (DOCX/PDF/ODT/RTF/EPUB):** comando `export-doc` (paleta) + `exportPandoc` em `export.ts`. Rust `pandoc_available()` e `export_pandoc(vault, note_path, dest)` — o formato é inferido pela extensão escolhida no diálogo de salvar. Antes de chamar o Pandoc, a nota é **achatada** (`expand_md`): expande `![[embeds]]` inline (profundidade 1, reusando o índice de stems do vault) e troca `[[wikilinks]]`/`[[a|alias]]`/`[[a#h]]` pelo **texto** (alias ou nome), além de remover o front-matter (`strip_frontmatter`). Roda `pandoc tmp.md -o dest --standalone --resource-path=<pasta da nota>;<vault>` (acha imagens relativas), com `no_window` no Windows; erros do Pandoc voltam como toast. Se o Pandoc não estiver instalado, avisa. i18n `export.*` PT/EN/ES.

## 0.50.0 — 2026-06-27

- **Bases — tabelas globais do vault (estilo Dataview):** novo `BasesView` (store `basesOpen`, menu do vault "Bases (tabelas)…" + comando `bases`). Monta por **UI** uma consulta sobre TODAS as notas: fonte (pasta/tag), **colunas** (chips das propriedades descobertas no índice), **filtro** (campo + operador + valor), **ordenação** (campo + ↑/↓), **visão** (tabela/cartões/quadro/lista) e limite — renderizando ao vivo pelo mesmo motor das views ` ```query ` (`buildQueryView`). **Bases salvas** com nome em `.quartzo/bases.json` (Rust `load_bases`/`save_bases`), reaplicáveis num clique.
- **Engine de query estendida:** `parseWhere` + `filterNotes` agora suportam operadores **`=`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `exists`** (numérico quando ambos são número, senão texto) e **ordenação asc/desc** (`sort campo desc`). Nova **visão `cards`** (galeria de cartões: título + propriedades) em `buildQueryView` + CSS `q-qcards`. Tudo retrocompatível com os blocos ` ```query ` existentes. i18n `bases.*` PT/EN/ES.

## 0.49.0 — 2026-06-27

- **Modo foco / zen:** store `zenMode` + comando `toggle-zen` (paleta, hint "foco"; configurável em Atalhos). Classe `.app-zen` no container raiz esconde `.qtitlebar`, `.app-sidebar`, `.q-resizer`, `.q-editor-tabs` e `.q-editor-toolbar` e centraliza `.q-main` (`max-width:900px;margin:auto`). Ao entrar, fecha painéis (outline/backlinks/git/rightPane). Sai com **Esc** (handler global) ou **botão flutuante** discreto (`.zen-exit`, canto sup. dir.). SFX de abrir/fechar. i18n PT/EN/ES.

## 0.48.0 — 2026-06-27

- **Visão do vault — órfãs e recentes:** novo `InsightsModal` (store `insightsOpen`, no menu do vault "Órfãs e recentes…" + comando `vault-insights` na paleta), com **abas Recentes/Órfãs**. Rust `vault_insights(vault, recent_limit)` varre os `.md` (reusa `collect_md`+`parse_links`+resolução por nome/caminho do grafo), calcula **grau total** (entrada+saída) de cada nota → **órfã = grau 0**, e devolve as **recentes por mtime** (top 30) com `path/name/rel/modified` (structs `NoteInfo`/`VaultInsights`). A UI lista cada nota (pasta + data nas recentes; "sem links" nas órfãs), abre num clique e tem botões de **fixar/favoritar** no hover. i18n `insights.*` PT/EN/ES.

## 0.47.0 — 2026-06-27

- **Limpar notas duplicadas:** novo `DuplicatesModal` (store `duplicatesOpen`, no menu do vault "Notas duplicadas…" + comando `find-duplicates` na paleta). Rust `find_duplicate_notes(vault)` varre os `.md` (reusa `collect_md`), normaliza CRLF→LF + `trim_end`, agrupa por hash (`fnv1a`) e devolve grupos com 2+ arquivos (mais antigo primeiro). A UI lista cada grupo com a **mais antiga preservada** (desmarcada) e as cópias **pré-marcadas** pra Lixeira; remove via `delete_to_trash`, tira das abas abertas e re-escaneia. i18n `dup.*` PT/EN/ES.
- **Fixar nota no topo + Favoritar no clique-direito:** o menu de contexto da nota (FileTree) ganhou **Fixar no topo/Desafixar** (`togglePin`, ícone alfinete) e **Favoritar/Remover dos favoritos** (`toggleBookmark`, estrela). "Fixar no topo" cria uma seção **Fixadas** no alto da sidebar (store `pinned` por vault em `quartzo:pinned:<vault>`, `loadPinned` no boot/troca de vault), **separada** dos Favoritos. Ambos também via Ctrl+Shift+S (favoritar).
- **Menu de contexto nunca mais cortado:** `ContextMenu` agora **mede o tamanho real** após render e reposiciona pra caber 100% na janela (encosta na borda / abre pra cima quando perto do fim), com `max-height` + scroll para menus altos. Some o flash via `visibility` até ajustar. Resolve o menu "comido" pela janela em qualquer canto.

## 0.46.0 — 2026-06-27

- **Vaults duplicados corrigidos:** `addRecentVault`/`getRecentVaults`/`removeRecentVault` agora comparam por **caminho normalizado** (`normVault`: minúsculas, `\`→`/`, sem barra final) — a mesma pasta não entra 2× (ex.: `D:\X` vs `D:/X`) e `getRecentVaults` **deduplica na leitura**, então a duplicata que já estava salva (o "WINDOWS - DAVINCI RESOLVE" repetido) some sozinha.
- **Renomear/remover vault direto no menu:** o dropdown de vaults ganhou **botões inline** por item (lápis = renomear apelido, lixeira = remover da lista) que aparecem no hover — sem precisar abrir "Gerenciar vaults". Para isso, `CtxMenuItem` ganhou `actions?: CtxMenuAction[]` (o `ContextMenu` renderiza os botões à direita) e foi criado um **diálogo de texto reutilizável** `askPrompt`/`PromptDialog.svelte` (usado no renomear; Enter confirma, Esc cancela). Remover **não apaga a pasta do disco** (confirma antes via `askConfirm`).
- **Grupo de atalhos recolhível:** a seção inferior da sidebar (Nota do dia, Memória, Grafo, Canvas, Rascunho, Versões) virou um grupo **"Atalhos" com setinha ▾/▸** (igual à seção TAGS), persistido em `sidebarShortcutsOpen`. **Configurações** fica sempre visível abaixo. i18n PT/EN/ES.

## 0.45.0 — 2026-06-27

- **Salvar na nuvem acessível (QuickSave):** botão de **nuvem na barra de título** (com **badge** do nº de alterações pendentes) + **Ctrl+S** + comando na paleta (`cloud-save`) abrem um **popover** ancorado no topo-direito — sem precisar abrir nota nem ir nas Configurações. O painel lista os arquivos alterados com **checkbox por arquivo** (etiqueta +/−/→/• por estado), **“Selecionar tudo”**, mensagem opcional e um botão que troca de rótulo: **“Salvar tudo na nuvem”** (tudo marcado) ou **“Salvar N na nuvem”** (subconjunto). Ao salvar, faz commit e, se houver remoto, **push automático** (toast “Salvo na nuvem”); sem remoto, salva local e avisa. Mostra estado do remoto (sincronizado / N pra enviar / botão **Receber N**) e oferece **Configurar versões** quando o vault ainda não é repo.
- **Backend:** novo comando Rust `git_commit_files(vault, message, files)` — faz `git add -A -- <files>` + `git commit -m … -- <files>` (commit **seletivo**; inclui os dois lados de renomeios); com `files` vazio cai no `git add -A` (salvar tudo). Store `gitSync` (status + remoto) compartilhada pelo badge e pelo painel, atualizada ao abrir/trocar de vault e no `vault-changed`. i18n PT/EN/ES.

## 0.44.0 — 2026-06-27

- **Configurações — layout:** a navegação lateral (Geral…Sobre) ganhou `overflow-y-auto` + `shrink-0` nos itens e o diálogo virou `h-[600px] max-h-[88vh]` — o **“Sobre” não fica mais colado na borda** e a lista rola direito em telas menores.
- **Guia do usuário** (`docs/GUIA.md`, linkado no README): tutorial completo dos comandos e recursos (wikilinks/aliases/transclusão, backlinks/menções, relink, buscas, atalhos, views, grafo/canvas/rascunho, vídeo, Git, PRISMA, configurações).

## 0.43.0 — 2026-06-27

- **Relink — corrigir links quebrados:** botão (ícone de elo partido) na barra do editor + comando na paleta. O `RelinkModal` detecta `[[links]]`/`![[anexos]]` da nota que não resolvem no vault e, para cada um, oferece **3 caminhos (escolha do usuário)**: **Buscar no vault** (por nome), **Escanear o PC** (Rust `scan_for_file` varre Desktop/Documentos/Downloads/Imagens/Vídeos/Música + vault, exato por nome, cap 100/prof. 6) ou **Escolher arquivo…** (diálogo). Ao escolher, reaponta o link; se o arquivo estiver **fora do vault**, é copiado pra `attachments/` (Rust `import_attachment`, com sufixo anti-colisão) e o link é refeito por nome — preservando `!`, alias e `#seção`. Grava no disco + atualiza o editor ao vivo.

## 0.42.0 — 2026-06-27

- **Menções não-linkadas mais ricas:** no painel de Backlinks, cada menção mostra o **termo destacado** (`<mark>`) no trecho e ganha um botão **“Linkar”** que converte a menção em `[[link]]` na nota de origem. Rust `link_mention(path, target_name)` envolve as ocorrências (palavra inteira, case-insensitive) em `[[ ]]`, **pulando wikilinks e código** (inline e cercado) já existentes; re-sincroniza a aba aberta não-suja. i18n PT/EN/ES.

## 0.41.0 — 2026-06-27

- **Transclusão de notas (`![[Nota]]`):** o embed de uma nota `.md` agora renderiza o **conteúdo dela inline**, num cartão com borda accent + título clicável (abre a nota). `enhance` cria um placeholder `.q-embed` e `renderEmbedsIn` (pós-render) lê e renderiza o corpo (profundidade 1 — sem re-embutir, evita recursão). `embedNotePath` resolve só `.md` (exclui imagens/vídeo/pdf), reaproveitando `resolveWikilink` (inclui aliases). Setting `embedNotes` (default on) + toggle em **Configurações › Markdown**.

## 0.40.0 — 2026-06-27

- **Aliases de front-matter:** `aliases: [Apelido, Outro]` (ou escalar / lista em bloco) na nota faz `[[Apelido]]` resolver pra ela. Rust `build_alias_index` (parser `parse_aliases`/`frontmatter_block`) → store `aliasIndex` (carregado por vault + no vault-changed); `resolveWikilink` cai no alias após nome/caminho; **autocomplete de `[[`** também sugere os aliases (com `↪ nota`).

## 0.39.0 — 2026-06-27

- **Histórico de navegação:** voltar/avançar entre notas com **Alt+←/Alt+→** e botões na barra de título (estilo navegador). `src/lib/stores/nav.ts` (navStack/navIndex + canBack/canForward; grava em cada troca de aba ativa via `recordNav`, com supressão ao voltar/avançar). Comandos `nav-back`/`nav-forward` na paleta.
- **Favoritos (bookmarks):** marque a nota pela **estrela** na barra do editor ou **Ctrl+Shift+S** (`toggle-bookmark`); persistido por vault em `quartzo:bookmarks:<vault>`. Seção **Favoritos** na barra lateral (abrir/remover). i18n PT/EN/ES.

## 0.38.0 — 2026-06-27

- **Buscar e substituir na nota:** `@codemirror/search` integrado — **Ctrl+F** abre o painel (buscar, substituir, substituir tudo, próximo/anterior, regex/case) no topo do editor, **tematizado** (dark/cristal) via `lumTheme`. Botão de lupa na barra do editor (`openSearchPanel`) e realce de ocorrências (`highlightSelectionMatches`). `searchKeymap` adicionado ao editor.

## 0.37.0 — 2026-06-27

- **Renomear nota atualiza os links (refactor-safe):** ao renomear uma `.md`, o Rust `rename_note(vault, path, newName)` renomeia o arquivo **e varre todas as notas do vault** reescrevendo os `[[wikilinks]]`/`![[embeds]]` que apontavam pra ela — preservando **apelido** (`|alias`), **heading** (`#seção`) e **caminho** (`pasta/Nota`), sem falsos-positivos (`Velhote` não vira `Novote`). O front (`renameEntry`) usa `rename_note` para `.md` (e `rename_path` para pastas), re-sincroniza as abas abertas **não-sujas** (e atualiza o CodeMirror ativo ao vivo) pra a auto-gravação não sobrescrever a correção. Toast informa quantas notas foram atualizadas.

## 0.36.0 — 2026-06-27

- **Autocomplete de `[[wikilinks]]`:** ao digitar `[[` no editor, o CodeMirror sugere as notas do vault (com filtro por nome); ao escolher, insere o nome e **fecha o `]]`** sozinho (sem duplicar se já houver). Fonte de autocomplete nova (`wikiSource`) combinada com o menu "/"; usa `flatFiles()`. Setting `wikilinkAutocomplete` (default on) + toggle em **Configurações › Editor**.

## 0.35.0 — 2026-06-27

- **Gerenciar vaults (renomear + remover):** no menu do nome do vault (canto da barra lateral) há uma entrada **“Gerenciar vaults…”** que abre um modal (`VaultManager.svelte`) listando todos os vaults salvos — cada um com **apelido editável** (rename) e **remover da lista** (não apaga a pasta do disco). Apelido persistido em `quartzo:vaultLabels` (`vaultLabel`/`setVaultLabel`), usado também na barra lateral e no menu de troca. `removeRecentVault` agora também limpa o apelido.

## 0.34.0 — 2026-06-27

- **Segurança (auditoria):** corrigido **path traversal** no deep link `quartzo://note/…` — o fallback montava o caminho sem neutralizar `..`, permitindo que um link malicioso (`..%2f..%2f…`) abrisse arquivos **fora do vault**. Agora os segmentos `.`/`..`/vazios são removidos e o alvo fica sempre dentro do vault (`+page.svelte`).
- **Robustez:** `prisma_search_assets` agora tolera colunas `NULL` (path/filename/ext/type) — antes uma linha com campo nulo era **descartada silenciosamente** da busca.

## 0.33.0 — 2026-06-27

- **i18n do corpo das Configurações (conclusão):** todo o texto visível das Configurações agora é PT/EN/ES — descrições de cada opção, **Tutorial** (8 passos), **Sobre**, seções **Markdown/Aparência/Nuvem/Integrações/Atualizações**, os **Plugins nativos** (`feat.*`/`featd.*`) e os **nomes dos atalhos** (reaproveitando as chaves `cmd.*`). +178 chaves (×3 idiomas) via dict, `tutorialSteps`/`delays` viraram `$derived` para reagir à troca de idioma. **Marco: i18n do app concluída de ponta a ponta.**

## 0.32.0 — 2026-06-26

- **Deep link `quartzo://note/<caminho>`:** o PRISMA (ou qualquer app) abre uma nota específica do Quartzo por link. Plugins `tauri-plugin-deep-link` + `tauri-plugin-single-instance` (foco na instância existente, sem abrir 2 janelas); `register_all()` registra o esquema no SO; handler decodifica o caminho e emite `deeplink:open-note` → o front resolve e abre a nota. Esquema declarado no `tauri.conf` + capability `deep-link:default`.
- **Comando “Copiar link da nota (quartzo://)”** (paleta Ctrl+K) — copia `quartzo://note/<rel>` da nota ativa pra colar no PRISMA. Fecha o ciclo: PRISMA→Quartzo (`prisma://asset`) e Quartzo→PRISMA (`quartzo://note`).

## 0.31.0 — 2026-06-26

- **Integração PRISMA — Anexar mídia:** novo seletor (`PrismaPicker`) que lê o banco do PRISMA **read-only** (`%APPDATA%\com.paulo.prisma\prisma.db` via rusqlite) e lista os assets com miniatura/busca; ao escolher, insere na nota atual `[arquivo](prisma://asset/<id>) ([abrir arquivo](file:///…))`. Acionável pela **paleta (Ctrl+K)** e por **Configurações › Integrações › Anexar mídia…**. Rust: `prisma_db_present`, `prisma_search_assets`.
- **Links de app clicáveis:** `prisma://` e `quartzo://` (além de `file:`/`mailto:`) agora abrem ao clicar dentro das notas (antes só `http/https`).

## 0.30.0 — 2026-06-26

- **Zoom do grafo fluido:** o `onlyRenderVisibleElements` agora só liga em grafos **enormes (>800 nós)** — em grafos normais ele causava **mount/unmount de nós a cada passo de zoom** (o lag do zoom). Sem ele, o zoom é só um transform de GPU. Além disso, no **modo leve** o **emoji do nó não é renderizado** (centenas de glyphs re-rasterizando a cada nível de zoom era um custo grande); o nó vira um círculo chapado colorido. Pan/zoom bem mais suaves.

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
