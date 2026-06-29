// Verificação de atualização via GitHub Releases + notas de versão (changelog).

/** Repositório onde as releases são publicadas (owner/repo). Ajuste se necessário. */
export const GITHUB_REPO = "Paulothedeveloper/quartzo";

export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

/** Notas de atualização exibidas em Configurações > Atualizações (mais novo primeiro). */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.57.1",
    date: "2026-06-29",
    items: [
      "Android: a barra de formatação do editor agora fica fixa no topo da nota (sempre visível e fácil de tocar). Antes ela ficava escondida atrás do teclado. Corrigido após testar no aparelho.",
      "Lista de notas vazia mostrava \"Grafo vazio\" por engano — agora mostra \"Nenhuma nota ainda. Toque em + para criar.\" (nos 5 idiomas).",
      "Desktop: arrastar pra reordenar tópicos agora funciona no app (o Tauri estava bloqueando o arraste interno).",
    ],
  },
  {
    version: "0.57.0",
    date: "2026-06-28",
    items: [
      "Grafo com IMPULSOS sinápticos: pontos de luz viajam pelas conexões, como energia passando de uma nota pra outra (neurônios se comunicando). Feito pra NÃO travar — só alguns impulsos por vez, revezando; o resto fica parado. Continua a 60 fps.",
      "Mais idiomas: agora são 5 — Português, English, Español, Français e Deutsch. Troque em Configurações › Geral.",
      "App mobile mais nativo: lista de notas navega por pastas (entra/volta) com toque longo pra ações (favoritar, fixar, renomear, apagar); editor com barra de formatação que sobe junto com o teclado; busca em tela cheia; e as telas de Configurações/Bases/etc. agora ocupam a tela toda no celular (sem mais cara de desktop espremido).",
      "Explorador: ordene os tópicos como quiser — A→Z, Z→A, aleatório ou MANUAL (arraste pra reposicionar; a ordem fica salva por vault). Botão de ordenação no topo da lista.",
    ],
  },
  {
    version: "0.56.0",
    date: "2026-06-28",
    items: [
      "App mobile DE VERDADE (não mais o desktop espremido): barra de abas embaixo (Notas, Buscar, Grafo, Mais), lista de notas com busca, editor em tela cheia ao abrir a nota e botão flutuante (+) pra criar. Ícone de cristal no app.",
      "Grafo: travamento eliminado de vez. A física ficava rodando ao vivo o tempo todo (o grafo repintava mesmo parado, sem você mexer) — agora o layout abre pronto e CONGELA, então pan e zoom ficam lisos. A física só reage de leve quando você ARRASTA um nó (e para sozinha ao soltar). Mesmo visual, muito mais fluido.",
      "Menu de vaults mostra o caminho embaixo do nome (distingue vaults com o mesmo nome em pastas diferentes) e a lista atualiza na hora ao remover/renomear.",
      "Salvar todos os vaults de uma vez na nuvem: novo botão em Configurações › Nuvem (commit + push em cada vault com repositório/remoto), além do salvar individual.",
      "Ícone do app (logo de cristal) aplicado no Android.",
    ],
  },
  {
    version: "0.55.0",
    date: "2026-06-27",
    items: [
      "Criar vault: agora dá pra CRIAR um vault do zero (não só abrir um existente) — botão na tela inicial, no menu de vaults e no Ctrl+K. Escolhe onde + nome e já abre.",
      "Tutorial na 1ª abertura: um tour rápido (8 passos) apresentando vault, notas, links, navegação, grafo/canvas e personalização. Reabre pelo Ctrl+K → “Ver tutorial”.",
      "Tela de entrada corrigida: o título não é mais cortado; conteúdo se ajusta a janelas baixas e respeita as bordas no mobile.",
      "Android: app utilizável no celular (vault no armazenamento do app, sidebar em gaveta, sem barra de janela, safe-area). APK + AAB no GitHub.",
    ],
  },
  {
    version: "0.54.0",
    date: "2026-06-27",
    items: [
      "PDF/HTML com cara premium: novo visual editorial — cabeçalho com a marca + data, título grande com régua em degradê, corpo em tipografia serifada, tabelas estilo revista, citações e blocos de código refinados e um rodapé discreto com o nome da nota.",
    ],
  },
  {
    version: "0.53.0",
    date: "2026-06-27",
    items: [
      "PDF/Impressão corrigidos: antes o PDF saía com o conteúdo jogado pra um lado e o título errado (“Tauri + SvelteKit…”). Agora a impressão usa um documento isolado e limpo, com o texto ocupando a página inteira e o título igual ao nome da nota.",
    ],
  },
  {
    version: "0.52.0",
    date: "2026-06-27",
    items: [
      "Exportar Word agora é 100% nosso: troquei o Pandoc (que era um programa externo) por um gerador de .docx embutido no próprio Quartzo — não precisa instalar nada. Ctrl+K → “Exportar como Word (.docx)”.",
      "O .docx sai com títulos, negrito/itálico/riscado, listas, tabelas, blocos de código, citações, linhas e imagens embutidas. (PDF continua pela impressão do sistema; HTML também é nativo.)",
    ],
  },
  {
    version: "0.51.0",
    date: "2026-06-27",
    items: [
      "Exportar com Pandoc: Ctrl+K → “Exportar com Pandoc” gera DOCX, PDF, ODT, RTF ou EPUB da nota (formato escolhido no diálogo de salvar). Antes de exportar, ele “achata” a nota — expande os ![[embeds]] e troca os [[wikilinks]] pelo texto. (Requer o Pandoc instalado.)",
    ],
  },
  {
    version: "0.50.0",
    date: "2026-06-27",
    items: [
      "Bases (tabelas do vault): novo painel (menu do vault ou Ctrl+K → “Bases”) pra montar uma tabela/quadro/lista/cartões com TODAS as notas do vault filtradas por propriedade — escolha fonte (pasta/tag), colunas, filtro (com operadores =, ≠, >, <, contém, existe), ordenação e limite, por menus.",
      "Salve consultas com nome (ficam em .quartzo/bases.json) e reabra com um clique.",
      "Os blocos ```query nas notas também ganharam os novos operadores e a visão “cards”.",
    ],
  },
  {
    version: "0.49.0",
    date: "2026-06-27",
    items: [
      "Modo foco (zen): esconde barra de título, barra lateral, abas e painéis e centraliza só o editor numa coluna confortável. Ative pela paleta (Ctrl+K → “Modo foco”) e saia com Esc ou no botão flutuante.",
    ],
  },
  {
    version: "0.48.0",
    date: "2026-06-27",
    items: [
      "Órfãs e recentes: nova visão do vault (menu do vault ou Ctrl+K → “Órfãs e recentes”) com duas abas — Recentes (notas modificadas por último) e Órfãs (notas sem nenhum link de entrada ou saída).",
      "Cada item abre a nota num clique e tem atalho rápido pra fixar no topo ou favoritar.",
    ],
  },
  {
    version: "0.47.0",
    date: "2026-06-27",
    items: [
      "Notas duplicadas: novo limpador (no menu do vault ou Ctrl+K → “Notas duplicadas”) acha notas com conteúdo idêntico — ex.: a mesma adicionada duas vezes — e manda as cópias pra Lixeira num clique (mantém a mais antiga).",
      "Fixar nota no topo: no clique-direito, “Fixar no topo” cria uma seção Fixadas no alto da barra lateral (separada dos Favoritos). Também tem “Favoritar”.",
      "Menu do clique-direito não fica mais cortado pela janela: ele se reposiciona sozinho pra caber sempre, em qualquer canto.",
    ],
  },
  {
    version: "0.46.0",
    date: "2026-06-27",
    items: [
      "Vaults repetidos: a mesma pasta não entra mais duas vezes na lista (corrige a duplicata que aparecia ao reabrir) e duplicatas antigas somem sozinhas.",
      "No menu de vaults, cada item agora tem botão de renomear (apelido) e de remover da lista — direto ali, sem abrir 'Gerenciar vaults'.",
      "A seção de atalhos do rodapé da barra lateral (Nota do dia, Grafo, Canvas, Rascunho, Versões…) agora recolhe e expande com uma setinha, igual às outras seções.",
    ],
  },
  {
    version: "0.45.0",
    date: "2026-06-27",
    items: [
      "Salvar na nuvem direto da barra de título: o botão de nuvem (com contador de alterações pendentes) abre um painel rápido — não precisa mais ir nas Configurações.",
      "Escolha o que salvar: marque/desmarque os arquivos alterados ou clique em “Salvar tudo na nuvem” de uma vez. Mensagem opcional para a versão.",
      "Atalho Ctrl+S abre o painel Salvar na nuvem. Ao salvar, envia ao remoto automaticamente (e mostra se há versões novas pra receber).",
    ],
  },
  {
    version: "0.44.0",
    date: "2026-06-27",
    items: [
      "Configurações: a lista lateral (Geral…Sobre) agora rola e não fica mais colada na borda; o painel se adapta a telas menores.",
      "Novo Guia do usuário no GitHub explicando todos os comandos e recursos do app.",
    ],
  },
  {
    version: "0.43.0",
    date: "2026-06-27",
    items: [
      "Corrigir links quebrados (Relink): botão na barra do editor (e Ctrl+K) lista os [[links]]/![[anexos]] que não apontam pra nada. Para cada um, escolha: buscar no vault, escanear o PC (Desktop/Documentos/Downloads…) ou achar manualmente — e reaponta sozinho.",
      "Se o arquivo achado estiver fora do vault, ele é copiado pra dentro (attachments) e o link é refeito.",
    ],
  },
  {
    version: "0.42.0",
    date: "2026-06-27",
    items: [
      "Menções não-linkadas melhores: o termo aparece destacado no trecho e cada menção tem um botão “Linkar” que transforma a menção em [[link]] na nota de origem (pula código e links já existentes).",
    ],
  },
  {
    version: "0.41.0",
    date: "2026-06-27",
    items: [
      "Embutir notas (transclusão): ![[Nota]] agora mostra o conteúdo daquela nota inline, dentro de um cartão — clique no título pra abrir. Liga/desliga em Configurações › Markdown.",
    ],
  },
  {
    version: "0.40.0",
    date: "2026-06-27",
    items: [
      "Aliases de nota: declare aliases: [Apelido] no front-matter e use [[Apelido]] — o link resolve pra nota certa. Os apelidos também aparecem no autocomplete de [[.",
    ],
  },
  {
    version: "0.39.0",
    date: "2026-06-27",
    items: [
      "Histórico de navegação: voltar/avançar entre notas com Alt+← / Alt+→ e botões no topo (estilo navegador).",
      "Favoritos: marque notas com a estrela (na barra do editor ou Ctrl+Shift+S); elas aparecem numa seção “Favoritos” na barra lateral.",
    ],
  },
  {
    version: "0.38.0",
    date: "2026-06-27",
    items: [
      "Buscar e substituir DENTRO da nota: Ctrl+F abre o painel (com substituir, próximo/anterior, tudo), no estilo do app. Também há um botão de lupa na barra do editor.",
    ],
  },
  {
    version: "0.37.0",
    date: "2026-06-27",
    items: [
      "Renomear nota agora corrige os links: ao renomear, o Quartzo varre o vault e atualiza todos os [[links]] e ![[embeds]] que apontavam pra ela (preserva apelido, #seção e pasta).",
      "Sem mais links quebrados ao renomear. As notas abertas se atualizam sozinhas.",
    ],
  },
  {
    version: "0.36.0",
    date: "2026-06-27",
    items: [
      "Autocomplete de [[wikilinks]]: ao digitar [[ no editor, aparece a lista de notas do vault (com filtro) — escolha e ele fecha o ]] sozinho.",
      "Liga/desliga em Configurações › Editor.",
    ],
  },
  {
    version: "0.35.0",
    date: "2026-06-27",
    items: [
      "Gerenciar vaults: no menu do nome do vault → “Gerenciar vaults…”, agora dá pra renomear (apelido) e remover vaults da lista. Remover NÃO apaga a pasta do disco.",
      "O apelido aparece na barra lateral e no menu de troca de vault.",
    ],
  },
  {
    version: "0.34.0",
    date: "2026-06-27",
    items: [
      "Segurança: links quartzo://nota agora ficam restritos ao vault (correção de path traversal encontrada em auditoria).",
      "Robustez: a busca de mídia do PRISMA não some mais com itens que tenham campos vazios no banco.",
    ],
  },
  {
    version: "0.33.0",
    date: "2026-06-27",
    items: [
      "Configurações 100% traduzidas (PT/EN/ES): todas as descrições, o Tutorial, o Sobre, os Plugins nativos e os nomes dos atalhos agora seguem o idioma.",
      "Marca: internacionalização concluída de ponta a ponta no app.",
    ],
  },
  {
    version: "0.32.0",
    date: "2026-06-26",
    items: [
      "Deep link quartzo://nota: o PRISMA (ou qualquer app) pode abrir uma nota específica do Quartzo por link. Instância única — não abre duas janelas.",
      "Comando “Copiar link da nota (quartzo://)” na paleta (Ctrl+K) — cole no PRISMA pra criar o vínculo de volta.",
      "Integração PRISMA ↔ Quartzo agora completa nos dois sentidos.",
    ],
  },
  {
    version: "0.31.0",
    date: "2026-06-26",
    items: [
      "Integração PRISMA — Anexar mídia: na paleta (Ctrl+K) ou em Configurações › Integrações, busque na biblioteca do PRISMA e insira na nota um link para o asset (abre no PRISMA ou no arquivo).",
      "Links prisma:// (e quartzo://) agora abrem ao clicar dentro das notas.",
    ],
  },
  {
    version: "0.30.0",
    date: "2026-06-26",
    items: [
      "Zoom do grafo mais fluido: parei de montar/desmontar nós a cada passo de zoom (só faço isso em grafos enormes, >800 notas) e, no modo leve, os emojis dos nós não são redesenhados a cada nível de zoom.",
    ],
  },
  {
    version: "0.29.0",
    date: "2026-06-26",
    items: [
      "Grafo ainda mais suave: no modo leve as conexões viram retas (mais baratas), os rótulos só existem no nó sob o cursor, e o passar do mouse não recalcula todas as conexões. Pan/zoom e hover bem mais leves.",
    ],
  },
  {
    version: "0.28.0",
    date: "2026-06-26",
    items: [
      "Grafo travando: corrigido de vez. Em grafos grandes, um “modo leve” desliga sombras/brilho/desfoque (que pesavam no pan/zoom) e congela o layout — fica bem fluido. Grafos pequenos mantêm a animação e os efeitos.",
    ],
  },
  {
    version: "0.27.0",
    date: "2026-06-26",
    items: [
      "Desempenho do grafo: muito mais leve e fluido (sem mudar o visual). Os dados dos nós são reaproveitados, os lobos recalculam em cadência menor e só o que está na tela é renderizado.",
    ],
  },
  {
    version: "0.26.0",
    date: "2026-06-26",
    items: [
      "Grafo com física contínua: os nós se acomodam suavemente ao abrir e reagem quando você arrasta um deles — os vizinhos se reorganizam. Liga/desliga em Configurações › Aparência.",
      "Wikilinks por caminho: [[pasta/Nota]] resolve a nota certa mesmo quando há nomes repetidos em pastas diferentes (no editor, no preview e no grafo).",
    ],
  },
  {
    version: "0.25.0",
    date: "2026-06-26",
    items: [
      "Busca fuzzy na paleta de comandos (Ctrl+K) e no “Ir para nota” (Ctrl+O): digite só algumas letras (ex.: “cfg” acha Configurações) e veja as letras casadas realçadas.",
      "Resultados ranqueados por relevância (prefixo, início de palavra e letras seguidas pontuam mais).",
    ],
  },
  {
    version: "0.24.0",
    date: "2026-06-23",
    items: [
      "Editor visual de Propriedades: edite o front-matter (YAML) da nota em campos no topo do editor — sem digitar YAML cru.",
      "Adicionar/renomear/remover propriedades; listas (ex.: tags) preservadas como YAML válido.",
      "Alimenta direto as tabelas/kanban dinâmicos. Liga/desliga em Configurações › Editor.",
    ],
  },
  {
    version: "0.23.0",
    date: "2026-06-23",
    items: [
      "Proxy de vídeo (ffmpeg): vídeos pesados (H.265/ProRes/.mov) que não tocam no app agora geram um proxy H.264 720p e tocam normalmente.",
      "Aviso automático quando o formato pode não tocar, com botão “Gerar proxy (ffmpeg)” no player de revisão.",
      "Player de revisão de vídeo agora totalmente traduzido (PT/EN/ES).",
    ],
  },
  {
    version: "0.22.0",
    date: "2026-06-23",
    items: [
      "Git v2 — Diferenças por arquivo: clique num arquivo alterado e veja o diff colorido (verde/vermelho) ali mesmo no painel.",
      "Git v2 — Sincronizar com remoto: botões Enviar (push) e Receber (pull), com indicador de “à frente/atrás” do GitHub.",
      "Git v2 — Snapshot automático: salve uma versão sozinho a cada N minutos quando houver mudanças (liga no painel de Versões).",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-06-23",
    items: [
      "Paleta de comandos totalmente traduzida (PT/EN/ES): nomes e dicas de cada comando agora seguem o idioma.",
      "Navegação das Configurações traduzida: todas as abas (Geral, Editor, Aparência, Plugins, Atalhos, Sobre…) e o título do diálogo.",
      "Lista “Ir para: nota” da paleta também localizada.",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-06-22",
    items: [
      "Tradução (EN/ES) ampliada: barra lateral, árvore de arquivos, abas, Outline, Backlinks e estados vazios do editor.",
      "Menus de contexto (arquivos e abas) e placeholders das paletas agora também traduzidos.",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-06-22",
    items: [
      "Atalhos completos: TODOS os comandos agora são atribuíveis (Configurações › Atalhos), com busca/filtro.",
      "Paleta de comandos e atalhos unificados — a paleta mostra o atalho de cada comando.",
      "Novos comandos: Nova nota (Ctrl+N), Nova pasta, Fechar aba (Ctrl+W), Paleta (Ctrl+K).",
      "Marco: Configurações no nível do Obsidian concluídas (Editor, Arquivos & Links, Aparência, Plugins, Espiar página, Atalhos).",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-06-22",
    items: [
      "Nova aba Configurações › Plugins nativos: ligue/desligue recursos como no Obsidian.",
      "Dá para esconder Grafo, Canvas, Rascunho, Versões (Git), Nota do dia, Memórias do Claude e Painel de tags.",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-06-22",
    items: [
      "Espiar página: passe o mouse num [[wikilink]] e veja um cartão com a pré-visualização da nota — no editor e na leitura.",
      "Opção de exigir Ctrl para acionar a pré-visualização (Configurações › Editor).",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-06-22",
    items: [
      "Nova aba Configurações › Arquivos & Links (estilo Obsidian).",
      "Local padrão para novas notas: raiz do vault ou pasta da nota atual.",
      "Confirmar antes de excluir — diálogo de confirmação ao mover para a lixeira.",
      "Reconstruir cache do vault (reindexa grafo, views e árvore de arquivos).",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-06-22",
    items: [
      "Configurações › Editor (estilo Obsidian): margens de tamanho confortável (largura legível) no editor e na leitura.",
      "Criação em pares de símbolos (fecha parênteses, aspas, ** e _ automaticamente).",
      "Verificação ortográfica no editor (corretor do sistema).",
      "Direita para esquerda (RTL) e opção de mostrar/ocultar o status do editor.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-06-22",
    items: [
      "Menu do vault (clique direito no nome do vault): Mostrar na pasta e Copiar caminho — igual ao Obsidian.",
      "Aparência: cor de destaque personalizável (paleta cristal + cor livre).",
      "Aparência: zoom global do app e tamanho da fonte da interface, ajustáveis.",
      "Início do épico de Configurações no nível do Obsidian — mais ondas a caminho.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-06-22",
    items: [
      "Grafo — regiões clicáveis (cérebro/cristal): cada pasta vira um lobo colorido e rotulado; clique nele para mergulhar (zoom) naquela parte do mapa.",
      "Grafo — rótulo limpo: ao passar o mouse aparece só o nome do nó sob o cursor, num cartão elegante (acabou a sobreposição de textos).",
      "Botão 'Ver tudo' para voltar à visão geral; o seletor de pasta também dá zoom no lobo.",
      "Idiomas: Português, English e Español (Configurações › Geral › Idioma), com detecção automática.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-06-22",
    items: [
      "Realce de código no tema claro + muito mais linguagens (Kotlin, Swift, Ruby, Dart, etc.).",
      "Atalhos editáveis: clique e pressione a nova combinação (Configurações › Atalhos).",
      "As abas abertas são restauradas ao reabrir o vault.",
      "Preview mais leve (Mermaid/views/math com debounce) e backlinks em cache.",
      "Templates antigos unificados nos Tipos de nota.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-06-22",
    items: [
      "Grafo com cara de cérebro: nós viram neurônios (pontos com glow) ligados por sinapses curvas.",
      "Rótulos do grafo só aparecem ao passar o mouse — visual limpo, sem fontes grandes.",
      "Projeto agora é público no GitHub (uso pessoal e gratuito, não à venda).",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-06-22",
    items: [
      "Ferramentas completas de criação de nota: barra de formatação no editor (negrito, títulos, listas, tarefas, tabela, código, callout, imagem, link, divisor) — liberdade total.",
      "Integração com o PRISMA: Configurações › Integrações (abrir o PRISMA + usar este vault como Base de Conhecimento dele). Quartzo → PRISMA → DaVinci.",
      "Grafo: nós (cristais) e rótulos menores, no tamanho do Obsidian.",
      "Tutorial atualizado com criação de notas e o ecossistema PRISMA.",
    ],
  },
  {
    version: "0.9.1",
    date: "2026-06-22",
    items: [
      "Editor visual de Tipos de nota em Configurações (sem mexer em JSON).",
      "Crie, edite (emoji, nome, pasta, campos, corpo) e exclua tipos; restaurar padrões.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-22",
    items: [
      "Rascunho: quadro de desenho à mão livre (Ctrl+Shift+D) com traços suaves.",
      "Caneta com cores e espessura, borracha, desfazer e limpar.",
      "Exportar o desenho como SVG para embutir nas notas; auto-salva o rascunho.",
    ],
  },
  {
    version: "0.8.1",
    date: "2026-06-22",
    items: [
      "Tipos de nota: crie notas com front-matter pronto (projeto, cliente, reunião, snippet…).",
      "Acesse por + Adicionar > Nova de tipo… ou pela paleta.",
      "Alimenta direto o kanban/tabela; tipos editáveis em .quartzo/types.json.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-22",
    items: [
      "Nuvem: sincronize o vault pelo Google Drive (ou OneDrive) — em Configurações > Nuvem.",
      "O app detecta a pasta do Drive e move o vault pra lá; a nuvem sincroniza sozinha.",
      "O original é preservado como backup.",
    ],
  },
  {
    version: "0.7.1",
    date: "2026-06-22",
    items: [
      "Exportar nota: Imprimir / Salvar como PDF (botão na barra do editor).",
      "Exportar nota como HTML autônomo (bonito, claro, pronto pra compartilhar).",
      "Comandos na paleta: Imprimir/PDF e Exportar HTML.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-22",
    items: [
      "Versionamento Git nativo: painel Versões (Ctrl+Shift+G).",
      "Inicie o versionamento, salve versões com mensagem e veja o histórico.",
      "Mostra os arquivos alterados e o branch atual — tudo local, sem nuvem.",
    ],
  },
  {
    version: "0.6.3",
    date: "2026-06-22",
    items: [
      "Barra lateral redimensionável: arraste a borda para aumentar/diminuir.",
      "Animação em tudo: painéis (Backlinks, Outline, painel ao lado) deslizam ao abrir.",
      "Listas entram em cascata: cabeçalhos, backlinks, menções e tags.",
      "Telas vazias e trocas de seção com transição suave.",
    ],
  },
  {
    version: "0.6.2",
    date: "2026-06-21",
    items: [
      "Animação de entrada ao abrir Grafo, Canvas, notas e tela inicial.",
      "Configurações: a troca de seção agora desliza suavemente.",
    ],
  },
  {
    version: "0.6.1",
    date: "2026-06-21",
    items: [
      "Moodboard no Canvas: cole (Ctrl+V) ou arraste imagens direto pro quadro.",
      "Imagens redimensionáveis (arraste os cantos), salvas no vault.",
      "Cartão de cor por conta-gotas e botão Organizar em grade.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-21",
    items: [
      "Onda 3 (vídeo): revisão de vídeo local dentro da nota — bloco ```video.",
      "Botão Marcar timecode insere [mm:ss] na nota enquanto você assiste.",
      "Timecodes [mm:ss] viram links que pulam o player no tempo certo.",
      "Exportar marcadores em CSV (timecode + SMPTE + nota) pro seu editor.",
      "Atalho /video no editor e toggle em Configurações > Markdown.",
    ],
  },
  {
    version: "0.5.1",
    date: "2026-06-21",
    items: [
      "Conta-gotas global: pegue a cor de qualquer pixel da tela (Ctrl+K → Conta-gotas, ou /cor no editor).",
      "Extrair paleta de uma imagem: vira swatches HEX direto na nota.",
      "Ajuste do nº de cores da paleta nas Configurações > Markdown.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-21",
    items: [
      "Onda 2: views dinâmicas a partir do front-matter — bloco ```query.",
      "Tabela, Kanban (por status) e Lista montadas sozinhas das suas notas.",
      "Tarefas do vault agregadas com checkbox que marca direto no arquivo.",
      "Filtros: pasta, tag, where (campo=valor), group, fields, sort, limit.",
      "Atalhos /tabela-dinâmica, /kanban e /tarefas no menu do editor.",
    ],
  },
  {
    version: "0.4.1",
    date: "2026-06-21",
    items: [
      "Nova barra de topo estilo Apple, com a identidade do Quartzo (cristal + busca central + Adicionar).",
      "Controles de janela próprios: fechar, minimizar e maximizar.",
      "Botão de manter a janela sempre no topo (always-on-top) — ótimo como referência por cima de outro app.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-21",
    items: [
      "Onda 1 (técnica): diagramas Mermaid no preview.",
      "Equações LaTeX/KaTeX ($inline$ e $$bloco$$).",
      "Blocos de código com botão copiar, badge de linguagem e números de linha.",
      "Cor inline: #RRGGBB vira um swatch no preview.",
      'Menu "/" no editor (título, tabela, código, callout, mermaid, math…).',
      "Quick switcher (Ctrl+O) agora cria a nota se não existir (buscar = criar).",
      "Mais configurações: nova aba Markdown, modo inicial do editor, toggles de render.",
    ],
  },
  {
    version: "0.3.3",
    date: "2026-06-21",
    items: [
      "Correção: estando no Grafo/Canvas, clicar numa nota (ou abrir o Canvas) agora troca de view de verdade.",
      "Cristais e ícones do grafo bem menores e mais legíveis.",
      "Removido o minimapa que poluía o canto do grafo.",
    ],
  },
  {
    version: "0.3.2",
    date: "2026-06-21",
    items: [
      "Efeitos sonoros (SFX) cristalinos em cliques, toggles, hover e ações.",
      "Controle de SFX + volume em Configurações > Aparência.",
      "Feedback tátil: todo botão \"afunda\" levemente ao clicar.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-06-21",
    items: [
      "Botão \"Buscar atualização\" (verifica releases no GitHub).",
      "Aba de Notas de atualização (changelog) nas Configurações.",
      "Tutorial passo a passo dentro do app.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-21",
    items: [
      "Tema claro completo (editor, preview, painéis).",
      "Outline / painel de cabeçalhos da nota (Ctrl+Shift+O).",
      "Menções não-linkadas no painel de Backlinks.",
      "Canvas: conexões entre cards + cards de imagem.",
      "CSS Snippets (.quartzo/snippets) para personalizar o visual.",
      "Ícone de quartzo em vetor no seletor de vaults.",
      "Correção: o grafo agora atualiza ao trocar de vault.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-21",
    items: [
      "Lista de vaults salvos (troca rápida, igual ao Obsidian).",
      "Redesenho do grafo: clusters por pasta, conexões visíveis, cor por pasta.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-20",
    items: [
      "Editor CodeMirror + preview premium (callouts, tabelas, código).",
      "Grafo, Canvas, Backlinks, busca global, tags, daily notes, templates.",
      "Instalador com a identidade do Quartzo.",
    ],
  },
];

export interface UpdateResult {
  status: "latest" | "available" | "error";
  current: string;
  latest?: string;
  url?: string;
  notes?: string;
  message?: string;
}

function parseVer(v: string): number[] {
  return v.replace(/^v/i, "").split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
}

/** Compara versões semver simples. >0 se a>b, <0 se a<b, 0 se iguais. */
export function cmpVer(a: string, b: string): number {
  const pa = parseVer(a);
  const pb = parseVer(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Consulta a última release no GitHub e compara com a versão atual. */
export async function checkForUpdate(current: string): Promise<UpdateResult> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      if (res.status === 404)
        return { status: "error", current, message: "Nenhuma release publicada ainda no GitHub." };
      return { status: "error", current, message: `Falha ao verificar (HTTP ${res.status}).` };
    }
    const data = await res.json();
    const latest = String(data.tag_name ?? "").replace(/^v/i, "");
    if (!latest) return { status: "error", current, message: "Resposta inesperada do GitHub." };
    if (cmpVer(latest, current) > 0)
      return { status: "available", current, latest, url: data.html_url, notes: data.body };
    return { status: "latest", current, latest };
  } catch {
    return { status: "error", current, message: "Sem conexão ou acesso bloqueado. Tente de novo." };
  }
}
