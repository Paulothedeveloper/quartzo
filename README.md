<div align="center">

# Quartzo

**Gerenciador de conhecimento pessoal local-first, em Markdown.**
Seu conhecimento, em cristal.

</div>

O **Quartzo** é um app desktop (Windows) para escrever, conectar e organizar notas em Markdown puro — pensado para ser a ferramenta **única e completa** de quem **edita vídeo**, faz **design gráfico** e **desenvolve software**, sem precisar de mais nada instalado.

Feito com **Tauri 2 + SvelteKit (Svelte 5) + TypeScript + Tailwind v4 + Rust**. Local-first: seus arquivos `.md` são seus, abrem em qualquer editor, e nada fica preso na nuvem.

## Recursos

**Escrita e conhecimento**
- Editor CodeMirror 6 + preview premium (callouts, tabelas, código com cópia, **Mermaid**, **KaTeX**, cor inline `#hex`).
- **Ferramentas completas de criação**: barra de formatação (negrito, títulos, listas, tarefas, tabela, código, callout, imagem, link…), menu `/`, e **Tipos de nota** (modelos com front-matter pronto).
- Wikilinks `[[ ]]`, backlinks + menções não-linkadas, tags, daily notes, templates, outline.
- **Grafo** de conexões e **Canvas** (moodboard: colar/arrastar imagens, redimensionar, swatches de cor, setas).

**Views dinâmicas (tipo Dataview)**
- Bloco ```query → **tabela**, **kanban** (por status), **lista** e **tarefas agregadas** do vault (checkbox marca no arquivo).

**Por público**
- **Vídeo:** revisão de vídeo local com **notas time-coded** e export de **marcadores (CSV)**.
- **Design:** **conta-gotas** global e **extração de paleta** de imagem; moodboard estilo PureRef.
- **Dev:** Mermaid, KaTeX, **Git nativo** (versões/histórico), Rascunho (desenho à mão livre).

**Mais**
- Tema claro/escuro, **SFX** e animação em tudo, barra de topo estilo Apple, sidebar redimensionável.
- **Exportar** nota em PDF/HTML. **Nuvem** via Google Drive/OneDrive (pasta sincronizada).
- Atualizações e tutorial dentro do app.

## Ecossistema (Quartzo + PRISMA + DaVinci)

O Quartzo conversa com o **PRISMA** (a biblioteca de mídia/DAM do mesmo autor):

```
Quartzo (você escreve o conhecimento)
   -> PRISMA (gerencia os assets e lê este vault como Base de Conhecimento)
      -> DaVinci Resolve (FCPXML + plano de cor citando as suas notas)
```

- Em **Configurações › Integrações**: abra o PRISMA e use este vault como base de conhecimento dele (o PRISMA reindexa ao vivo).
- Integração de menor atrito hoje = **pasta de vault compartilhada**. Evolução prevista: deep link `prisma://` para abertura direta entre os apps.

## Instalação

Baixe o instalador `Quartzo_x.y.z_x64-setup.exe` na página de **Releases** e execute. (App não assinado → o SmartScreen pode avisar; "Mais informações" → "Executar assim mesmo".)

## Desenvolvimento

```bash
npm install
npm run tauri dev      # rodar em desenvolvimento
npm run tauri build    # gerar o instalador
npm run check          # type-check (svelte-check)
```

## Privacidade

100% **local-first**: suas notas são arquivos `.md` no **seu** computador. O app não tem servidor, não coleta dados e não envia nada para lugar nenhum. A sincronização (opcional) usa a **sua** pasta do Google Drive/OneDrive — nada passa por nós.

## Uso e licença

Projeto **pessoal**, disponibilizado de forma **gratuita**. **Não é para venda** nem revenda — não comercialize o app nem cópias dele. Veja [LICENSE](LICENSE).

## Changelog

Toda mudança — pequena ou grande — é registrada em [CHANGELOG.md](CHANGELOG.md), nas **Notas de atualização** dentro do app, e na **release** do GitHub.

## Sobre o criador

Feito por **Paulo Adriel** — editor de vídeo e desenvolvedor — com Claude.

- GitHub: [@Paulothedeveloper](https://github.com/Paulothedeveloper)
- LinkedIn: [paulo-adriel](https://www.linkedin.com/in/paulo-adriel/)
- Instagram: [@paulo.videodev](https://instagram.com/paulo.videodev)

Faz parte de um ecossistema próprio com o **PRISMA** (biblioteca de mídia) e o fluxo do **DaVinci Resolve**.
