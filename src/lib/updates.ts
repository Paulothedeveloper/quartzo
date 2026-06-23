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
