# Guia do Quartzo — tudo que você precisa saber

O **Quartzo** é um gerenciador de conhecimento pessoal (PKM) local-first: suas
notas são arquivos **Markdown (`.md`)** numa pasta sua (o **vault**) — nada fica
preso no app. Este guia cobre os comandos e recursos principais.

> Dica de ouro: aperte **Ctrl+K** a qualquer momento. É a **Paleta de comandos** —
> tudo que o app faz está lá, com busca (digite "cfg" → Configurações).

---

## 1. Começando

1. **Abrir vault**: clique em **Abrir vault** na tela inicial (ou no nome do vault
   na barra lateral → *Abrir outra pasta…*). É só apontar pra uma pasta — o Quartzo
   lê e escreve `.md` nela.
2. **Nova nota**: botão **Nova nota** na barra lateral, ou **Ctrl+N**.
3. **Escrever**: digite em Markdown. Salva sozinho.
4. **Modos** (canto superior direito): **Editor** · **Dividido** · **Leitura**.

Vários vaults? Clique no **nome do vault** para abrir o menu. Cada vault da lista
tem, ao passar o mouse, um botão de **renomear** (apelido) e um de **remover da
lista** (não apaga a pasta do disco) — rápido, sem abrir nada. Se quiser a tela
completa, use **Gerenciar vaults…**. A mesma pasta nunca é listada duas vezes.

> A seção **Atalhos** no rodapé da barra lateral (Nota do dia, Grafo, Canvas,
> Rascunho, Versões…) **recolhe e expande** na setinha ▾/▸, como a seção TAGS.

---

## 2. Conectar ideias (o coração do PKM)

- **Wikilink**: escreva `[[Nome da nota]]` para linkar. Digite `[[` e o Quartzo
  **sugere** as notas (autocomplete) — escolha e ele fecha o `]]`.
- **Por caminho**: `[[pasta/Nota]]` resolve a nota certa mesmo com nomes repetidos.
- **Aliases**: na nota destino, no front-matter:
  ```yaml
  ---
  aliases: [Apelido, Outro nome]
  ---
  ```
  Aí `[[Apelido]]` também abre essa nota (e aparece no autocomplete).
- **Seguir o link**: **Ctrl/Cmd + clique** no wikilink (no editor ou na leitura).
- **Espiar (hover)**: passe o mouse num `[[link]]` para ver um cartão com a prévia.
- **Embutir nota (transclusão)**: `![[Nota]]` mostra o **conteúdo** daquela nota
  inline, num cartão (clique no título para abrir). Liga/desliga em
  *Configurações › Markdown*.
- **Embutir imagem/mídia**: `![[imagem.png]]` (o arquivo precisa estar no vault).

### Backlinks e menções
Painel **Backlinks** (Ctrl+Shift+B) mostra quem aponta pra nota atual. Embaixo,
as **Menções não-linkadas** (notas que citam o nome sem `[[ ]]`) — com o termo
**destacado** e um botão **Linkar** que vira `[[link]]` na nota de origem.

### Renomear sem quebrar
Ao **renomear** uma nota, o Quartzo **corrige todos os `[[links]]`** que apontavam
pra ela (preserva apelido, `#seção` e pasta).

### Relink (link quebrado)
Se um arquivo foi **renomeado/movido** e o link quebrou: botão de **elo partido**
na barra do editor (ou Ctrl+K → *Corrigir links quebrados*). Para cada link
quebrado você escolhe: **buscar no vault**, **escanear o PC** (Desktop, Documentos,
Downloads…) ou **escolher manualmente** — e ele reaponta. Se o arquivo estiver
fora do vault, é copiado pra dentro (`attachments/`) e o link é refeito.

---

## 3. Encontrar as coisas

- **Paleta de comandos** — **Ctrl+K** (tudo do app, com busca fuzzy).
- **Ir para nota** — **Ctrl+O** (pula pra qualquer nota; busca fuzzy; digite um
  nome novo para criar).
- **Buscar nas notas** — **Ctrl+Shift+F** (full-text em todo o vault).
- **Buscar/substituir na nota** — **Ctrl+F** (dentro do editor).
- **Histórico** — **Alt+←** / **Alt+→** (voltar/avançar) ou os botões no topo.
- **Favoritos** — estrela na barra do editor (ou **Ctrl+Shift+S**); aparecem na
  seção *Favoritos* da barra lateral.
- **Tags** — escreva `#tag`; a lista fica na barra lateral.

---

## 4. Estrutura e automação

- **Propriedades (front-matter)**: o painel no topo do editor edita o bloco YAML
  (`--- … ---`) em campos — sem digitar YAML. Alimenta as views dinâmicas.
- **Tipos de nota**: modelos prontos (em *+ Adicionar › Nova de tipo…* ou Ctrl+K).
  Editáveis em *Configurações › Tipos de nota*. Variáveis `{{date}}`, `{{time}}`, `{{title}}`.
- **Views dinâmicas** (bloco ` ```query `): geram **tabela**, **kanban** ou
  **lista de tarefas** a partir do front-matter/tarefas das notas. Pelo menu `/`:
  `/tabela-dinâmica`, `/kanban`, `/tarefas`.
- **Menu “/”**: digite `/` no editor para inserir título, tabela, código, callout,
  Mermaid, math, etc.

---

## 5. Visualizar e criar

- **Grafo** (Ctrl+G): mapa das conexões. Arraste, dê zoom (pinça/scroll), clique
  num nó para abrir. Em vaults grandes entra um **modo leve** automático (mais
  fluido). Liga/desliga a física em *Configurações › Aparência*.
- **Canvas** (Ctrl+Shift+C): quadro infinito — cards, imagens (colar/arrastar),
  cores e setas.
- **Rascunho** (Ctrl+Shift+D): desenho à mão livre; exporta SVG.
- **Mermaid / KaTeX**: ` ```mermaid ` para diagramas e `$...$` / `$$...$$` para
  fórmulas (ligáveis em *Configurações › Markdown*).
- **Cores**: `#RRGGBB` vira amostra; conta-gotas e extrair paleta de imagem (Ctrl+K).

---

## 6. Vídeo (para editores)

Bloco ` ```video ` (com `path:` e `fps:`) cria um **player de revisão** na nota.
Marque timecodes (`- [mm:ss]`), clique neles para pular, e exporte os marcadores
em **CSV**. Formato pesado (H.265/ProRes/.mov) não toca? Botão **Gerar proxy
(ffmpeg)** cria uma versão compatível (precisa do ffmpeg instalado).

---

## 7. Versões (Git) e nuvem

- **Salvar na nuvem** — **Ctrl+S** ou o **botão de nuvem** na barra de título (mostra
  um contador das alterações pendentes): abre um painel rápido onde você **marca os
  arquivos** que quer salvar — ou clica em **“Salvar tudo na nuvem”** de uma vez. Dá
  um nome opcional à versão e pronto: ele faz o commit e, se houver remoto, **envia
  sozinho**. Também mostra se há versões novas pra **Receber**. (Não precisa abrir
  nota nem ir nas Configurações.)
- **Versões (Git)** — Ctrl+Shift+G: o painel completo. Veja alterações (com **diff**
  por arquivo), histórico, Enviar/Receber e **Snapshot automático** (salva sozinho a
  cada N minutos). É aqui que você **inicia o versionamento** num vault novo. (Precisa
  do Git instalado.)
- **Nuvem** (*Configurações › Nuvem*): mova o vault pra uma pasta do Google Drive/
  OneDrive para sincronizar entre máquinas.

---

## 8. Ecossistema PRISMA

O **PRISMA** é a biblioteca de mídia (DAM). No Quartzo:
- **Anexar mídia do PRISMA** (Ctrl+K ou *Configurações › Integrações*): busca na
  biblioteca e insere um link pro asset.
- Links **`prisma://asset/<id>`** abrem o asset no PRISMA; **`quartzo://note/…`**
  abrem uma nota do Quartzo (use *Copiar link da nota* no Ctrl+K).
- Aponte o PRISMA para este vault como **Base de Conhecimento** — suas notas viram
  contexto pros planos de cor (Quartzo → PRISMA → DaVinci).

---

## 9. Personalizar

*Configurações* (Ctrl+,): **Idioma** (PT/EN/ES), **Aparência** (tema, cor de
destaque, zoom, fonte da interface, SFX, CSS snippets), **Editor** (fonte, Vim,
margens, espiar página, propriedades…), **Plugins nativos** (liga/desliga Grafo,
Canvas, Git, etc.), **Atalhos** (todos reconfiguráveis).

---

## Atalhos principais

| Ação | Atalho |
|------|--------|
| Paleta de comandos | `Ctrl+K` |
| Ir para nota | `Ctrl+O` |
| Buscar nas notas | `Ctrl+Shift+F` |
| Buscar/substituir na nota | `Ctrl+F` |
| Nova nota | `Ctrl+N` |
| Fechar aba | `Ctrl+W` |
| Voltar / Avançar | `Alt+←` / `Alt+→` |
| Salvar na nuvem | `Ctrl+S` |
| Favoritar nota | `Ctrl+Shift+S` |
| Grafo | `Ctrl+G` |
| Canvas | `Ctrl+Shift+C` |
| Rascunho | `Ctrl+Shift+D` |
| Backlinks | `Ctrl+Shift+B` |
| Outline | `Ctrl+Shift+O` |
| Versões (Git) | `Ctrl+Shift+G` |
| Recolher barra lateral | `Ctrl+\` |
| Configurações | `Ctrl+,` |

> Todos os atalhos são editáveis em *Configurações › Atalhos*.

---

Quartzo — uso pessoal e gratuito, não à venda. Seu conhecimento, em cristal. ✦
