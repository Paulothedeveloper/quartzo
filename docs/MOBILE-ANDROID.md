# Quartzo Mobile (Android) — Plano técnico completo

> Documento de planejamento para a versão **Android** do Quartzo. Fase **futura**
> (não iniciada). Objetivo do Paulo: um **app nativo de verdade, 100% integrado,
> com as MESMAS funções e funcionalidades do desktop** — não um "copia-e-cola"
> nem uma webview burra. Escrito em 2026-06-27 (Quartzo v0.35).

---

## 0. TL;DR — a boa notícia

O Quartzo já é **Tauri 2 + SvelteKit (Svelte 5) + Rust**. O Tauri 2 tem suporte
oficial a **Android e iOS**. Isso significa que **NÃO é reescrita**: o **mesmo**
frontend Svelte e o **mesmo** core Rust (`src-tauri`) compilam e rodam no Android.
O `lib.rs` já tem o ponto de entrada mobile preparado:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() { ... }
```

O trabalho concentra-se em **3 frentes**, não em refazer o app:

1. **Acesso a arquivos no Android** (vault = pasta de `.md`) — o item mais difícil.
2. **UI/UX para toque** (layout responsivo, navegação por gestos, sem barra de
   título de desktop) — o que o torna "app de verdade" e não cópia do desktop.
3. **Recursos desktop-only** (Git via binário do sistema, ffmpeg, leitura do
   banco do PRISMA, "mostrar na pasta", always-on-top) — adaptar ou desativar.

---

## 1. Stack e linguagens (o que será usado, da primeira à última linha)

| Camada | Linguagem / Tech | Observação |
|---|---|---|
| **Core / I/O / comandos** | **Rust** (edition 2021) | `src-tauri/src` — REUSADO. Alguns `#[tauri::command]` precisam de variante mobile (ver §4). |
| **UI** | **TypeScript + Svelte 5 (runes) + SvelteKit** (adapter-static) + **Tailwind v4** | `src/` — REUSADO; precisa de camada responsiva/touch. |
| **Editor** | **CodeMirror 6** | Funciona em touch; precisa de toolbar e tratamento de teclado virtual. |
| **Grafo/Canvas** | **@xyflow/svelte + d3-force** | Pan/zoom por pinça; o "modo leve" (v0.28+) ajuda muito no mobile. |
| **Ponte nativa Android** | **Kotlin** (gerado pelo Tauri em `gen/android`) + **Gradle** | Em geral não se escreve Kotlin à mão, exceto plugins nativos custom (ex.: SAF). |
| **Build system Android** | **Gradle** + **Android SDK/NDK** + **JDK 17** | Compila o Rust como `.so` (JNI) e empacota no APK/AAB. |
| **Empacotamento** | **APK** (sideload/teste) e **AAB** (Play Store) | Assinado com **keystore** (Java keytool). |

> **Resumo:** as linguagens são **Rust + TypeScript/Svelte** (99% reuso) **+ um
> pouco de Kotlin/Gradle** para a casca Android. Nada de Flutter/Kotlin-nativo do
> zero — seria jogar fora o app inteiro.

---

## 2. Ambiente de desenvolvimento (pré-requisitos, do zero)

No PC de build (Windows do Paulo serve):

1. **Rust** (já tem) + alvos Android:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```
2. **Android Studio** (ou só o command-line tools) com:
   - **Android SDK** (Platform API 34+; Build-Tools).
   - **NDK** (r26+).
   - **Platform-Tools** (adb).
3. **JDK 17** (o Gradle do Tauri exige 17).
4. **Variáveis de ambiente**: `ANDROID_HOME` (ou `ANDROID_SDK_ROOT`), `NDK_HOME`,
   `JAVA_HOME`.
5. **Tauri CLI** (já tem `@tauri-apps/cli`): usar os comandos `tauri android …`.
6. Um **dispositivo Android** com depuração USB **ou** um **emulador** (AVD).

Inicialização (uma vez):
```bash
npm run tauri android init      # gera gen/android (projeto Gradle + Kotlin)
npm run tauri android dev       # roda no emulador/dispositivo (hot-reload do front)
npm run tauri android build     # gera APK/AAB de release
```

> `tauri android init` cria `src-tauri/gen/android/` (versionar? Sim, mas com
> `.gitignore` cuidadoso — manter o projeto Gradle, ignorar build outputs).

---

## 3. O PROBLEMA CENTRAL: acesso a arquivos / onde mora o vault

No desktop, um vault é **uma pasta qualquer** que o Rust lê com `std::fs`
(`read_directory`, `read_file`, `write_file`, watcher `notify`, etc.). **No
Android isso não funciona igual** por causa do *scoped storage*:

- O app **só tem acesso livre** ao seu diretório privado
  (`/data/data/com.quartzo.app/…` e ao "app-specific external storage"
  `/storage/emulated/0/Android/data/com.quartzo.app/…`).
- Para ler uma **pasta escolhida pelo usuário** (fora do app), o Android exige o
  **SAF (Storage Access Framework)**: o usuário concede acesso a uma "document
  tree" e o app recebe **`content://` URIs** — que **`std::fs` NÃO abre**.

### Opções (decisão do Paulo necessária)

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Vault em armazenamento do app** | O vault vive em `Android/data/com.quartzo.app/vaults/…`; `std::fs` funciona direto. | Simples; reusa 100% do core Rust. | Pasta "escondida"; sync com desktop exige passo extra (ver §7). |
| **B. SAF (document tree)** | Usuário escolhe a pasta; app guarda permissão persistente; I/O via **plugin Kotlin** que traduz `content://` ↔ bytes. | Vault em qualquer lugar (inclusive pasta do Google Drive). | Precisa **escrever um plugin nativo** (Kotlin) e trocar TODA a I/O de `std::fs` por chamadas ao plugin. Trabalho grande. |
| **C. Híbrido** | App-storage por padrão (A) + import/export e sync por cima. | Pragmático; entrega rápido. | Sync não é "mágico". |

**Recomendação:** começar com **A (app-storage)** para validar o app rodando, e
evoluir para **B (SAF)** se o Paulo exigir vault em pasta arbitrária. A escolha
muda **quanto** de Rust precisa de adaptação:

- **Opção A** → quase nada muda no core (`std::fs` segue funcionando em paths do app).
- **Opção B** → criar `src-tauri/android/` plugin Kotlin (SAF) + uma camada de
  abstração de FS no Rust (`trait VaultFs`) com impl desktop (`std::fs`) e impl
  mobile (ponte SAF). **Esse é o maior item de esforço do projeto mobile.**

---

## 4. Recursos desktop-only — o que adaptar ou desativar

Mapeamento honesto. Cada `#[tauri::command]`/feature que **não** existe igual no
Android:

| Recurso desktop | Situação no Android | Plano |
|---|---|---|
| **Git** (`git_*` via `std::process::Command("git")`) | **Não há binário git** nem spawn de processos arbitrários. | Trocar por **lib pura** (`gix`/git-oxide ou `git2`/libgit2) **OU** desativar a aba Versões no mobile (feature flag). libgit2 compila no NDK mas dá trabalho. |
| **Proxy de vídeo** (`make_video_proxy` via `ffmpeg`) | Sem ffmpeg no device. | Desativar no mobile (ou usar `ffmpeg-kit`, pesado). O player de vídeo nativo do WebView ainda toca formatos compatíveis. |
| **Integração PRISMA** (`rusqlite` lendo `%APPDATA%\com.paulo.prisma\prisma.db`) | PRISMA é app **desktop**; não existe no Android. | Desativar o "Anexar mídia do PRISMA" e o picker no mobile. Os **deep links** `prisma://`/`quartzo://` podem continuar se houver app correspondente. |
| **`launch_prisma`, `prisma_installed`** | N/A no mobile. | Esconder a seção Integrações (ou mostrar "indisponível no celular"). |
| **`revealItemInDir` / "Mostrar na pasta"** | Não há gerenciador de arquivos equivalente. | Esconder a ação. |
| **`detect_cloud_folders` / mover p/ nuvem** | Caminhos de nuvem do Windows não existem. | Esconder; no Android o sync é outro (§7). |
| **Always-on-top, semáforo macOS, decorations:false, drag-region (TitleBar)** | Conceitos de janela desktop. | **Remover a TitleBar** no mobile; usar status bar + navegação mobile. |
| **Atalhos de teclado / paleta Ctrl+K** | Sem teclado físico (mas Bluetooth existe). | Manter atalhos (úteis com teclado externo) + **equivalentes touch** (botões/gestos) para tudo. |
| **File watcher `notify`** | Pode não emitir eventos de forma confiável em scoped storage. | Em app-storage funciona; em SAF, refazer via observador do plugin ou polling. |
| **`trash` (lixeira)** | Android não tem lixeira do SO. | Implementar "lixeira" própria (mover p/ `.trash/` no vault) no mobile. |

> **Estratégia recomendada:** uma **camada de capacidades** (`platform.ts` +
> `cfg!(mobile)` no Rust) que liga/desliga features por plataforma — o app mostra
> só o que funciona, sem telas quebradas. As features já são toggláveis
> (`FEATURE_PLUGINS`); estender com "disponível em mobile? sim/não".

---

## 5. UI/UX mobile — o que faz NÃO ser cópia do desktop

Aqui mora o "app de verdade". O layout atual é desktop (sidebar fixa 280px,
multi-painel, titlebar, hover). No mobile precisa virar **mobile-first** nas telas
pequenas, mantendo o desktop intacto (responsivo por breakpoint).

Mudanças de UX (sem perder funções):

- **Navegação**: sidebar vira **drawer** (gaveta deslizante / swipe da borda);
  abas viram uma lista ou um seletor; **bottom tab bar** opcional
  (Notas · Buscar · Grafo · Config).
- **Sem TitleBar**: remover semáforo/always-on-top; respeitar **safe areas**
  (notch, barra de gestos) com `env(safe-area-inset-*)`.
- **Toque**: alvos ≥ 44px; trocar `hover` por estados de toque/long-press;
  context menus viram **bottom sheets** ou long-press.
- **Editor**: toolbar de formatação fixa **acima do teclado virtual**; lidar com
  o `resize` quando o teclado abre (visualViewport); o menu "/" continua.
- **Grafo/Canvas**: **pinça pra zoom**, **arraste com 1 dedo**; manter "modo leve".
- **Espiar página (hover preview)**: vira **long-press** no `[[wikilink]]`.
- **Gestos**: swipe entre notas abertas; pull-to-refresh na árvore (opcional).
- **Densidade/tema/animações/SFX/idioma**: já existem e funcionam; só checar no device.

Técnica: usar os breakpoints do Tailwind (`md:`/`lg:`) e um store `isMobile`
(via `matchMedia`/tamanho de tela) para alternar shells de layout (`AppShell`
desktop vs `MobileShell`). **Mesmos componentes de conteúdo**, casca diferente.

---

## 6. Matriz de paridade de features (desktop → mobile)

- ✅ **Funciona direto** (reuso): edição Markdown, preview, wikilinks, backlinks,
  outline, tags, busca global, busca fuzzy, command palette, daily notes,
  templates/tipos de nota, **front-matter editor**, views ```query
  (tabela/kanban/tarefas), Mermaid, KaTeX, cor inline, **grafo**, **canvas**,
  **rascunho**, memórias do Claude, tema claro/escuro, i18n PT/EN/ES, snapshots
  automáticos (se Git mobile existir).
- ⚠️ **Precisa adaptar**: acesso ao vault (§3), lixeira, watcher, navegação/UI
  touch (§5), conta-gotas (EyeDropper API pode não existir no WebView Android →
  fallback), exportar/imprimir PDF (usar share/print do Android).
- ❌ **Desativar no mobile** (ou repensar): Git via binário, proxy ffmpeg,
  integração PRISMA (rusqlite), mostrar-na-pasta, mover-pra-nuvem do Windows,
  always-on-top.

---

## 7. Sincronização desktop ↔ mobile (crítico p/ "100% integrado")

"Integrado sem falhas" entre PC e celular = os **mesmos `.md`** nos dois. Opções:

| Estratégia | Como | Nota |
|---|---|---|
| **Pasta de nuvem (Google Drive/OneDrive) via SAF** | Vault na pasta sincronizada; app aponta via SAF (Opção B). | Mais "automático"; depende do SAF + app de nuvem instalado. |
| **Git remoto** (se Git mobile existir) | `pull`/`push` manual ou automático (já há snapshot automático). | Exige Git mobile (gix/libgit2) + auth. Bom pro perfil dev. |
| **Syncthing / terceiros** | Pasta sincronizada por app externo. | Fora do escopo do Quartzo; só documentar. |

> **Decisão necessária:** qual modelo de sync o Paulo quer. Isso amarra a escolha
> de §3 (SAF vs app-storage) e §4 (Git mobile sim/não).

---

## 8. Build, assinatura e publicação

1. `tauri android build --apk` (teste) / `--aab` (Play Store).
2. **Keystore** (uma vez): `keytool -genkey -v -keystore quartzo.keystore …`
   (guardar com MUITO cuidado — perder = não atualizar o app na loja).
3. Configurar assinatura no Gradle (`gen/android/.../build.gradle.kts` +
   `keystore.properties` fora do versionamento).
4. **Distribuição**:
   - **Sideload** (APK direto) — pra uso pessoal do Paulo, **sem loja, sem custo**.
   - **Play Store** (AAB) — conta de desenvolvedor (US$25 único), políticas,
     ficha da loja. Só se quiser distribuir.
5. **Auto-update**: na loja, é a própria Play Store. Sideload precisaria do
   `tauri-plugin-updater` apontando pro GitHub Releases (como no PRISMA).

---

## 9. Roadmap sugerido (fases, em ordem)

1. **F0 — Ambiente** (0,5 dia): instalar SDK/NDK/JDK, targets Rust, `android init`,
   rodar o app "como está" no emulador (vai abrir desktop-layout esmagado — é só
   pra validar a toolchain).
2. **F1 — Acesso a arquivos** (o maior): decidir §3. Implementar a camada de FS.
   Meta: abrir um vault, listar, ler e salvar `.md` no Android.
3. **F2 — Capacidades por plataforma**: feature flags desativando Git/ffmpeg/
   PRISMA/reveal/cloud no mobile, sem telas quebradas.
4. **F3 — Shell mobile**: drawer + navegação touch + remover TitleBar + safe areas
   + toolbar do editor acima do teclado. App utilizável com uma mão.
5. **F4 — Polimento touch**: grafo/canvas por gestos, long-press (context/hover),
   conta-gotas/exportar com fallback Android, share/print nativo.
6. **F5 — Sync** (§7): conforme decisão.
7. **F6 — Assinatura + distribuição** (sideload e/ou Play Store).
8. **F7 — QA em devices reais** (telas/Androids variados) + correções.

---

## 10. Decisões que preciso do Paulo (antes de começar a F1)

1. **Onde mora o vault no Android?** App-storage (rápido) vs SAF/pasta arbitrária
   (mais trabalho, mais flexível).
2. **Como sincronizar com o desktop?** Nuvem (SAF) / Git / Syncthing / só import-export.
3. **Git no celular?** Vale o esforço de libgit2/gix, ou desativa Versões no mobile?
4. **Distribuição?** Só pra ele (sideload) ou Play Store (conta + políticas)?
5. **iOS também?** (Tauri suporta; exige Mac + conta Apple US$99/ano. Provavelmente não.)

---

## 11. Riscos / armadilhas conhecidas

- **WebView Android** (System WebView/Chrome) varia por device/versão → testar
  CSS moderno (`color-mix`, `backdrop-filter`, `env(safe-area-inset)`),
  `EyeDropper` (provável ausência), reprodução de vídeo (codecs).
- **`std::fs` + scoped storage** = a maior fonte de bug; resolver cedo (F1).
- **libgit2/ffmpeg no NDK** = builds chatos; preferir desativar no MVP.
- **Tamanho do APK** (Rust + WebView assets) — otimizar com split por ABI.
- **Teclado virtual** cobrindo o editor — tratar `visualViewport`.
- **Performance** do grafo em devices fracos — o modo leve já mitiga; talvez
  baixar o limiar no mobile.
- **`gen/android` no Git** — versionar o projeto Gradle, ignorar `build/`,
  `.gradle/`, keystores e `local.properties`.

---

## 12. Decisões TRAVADAS (2026-06-27) ✅

Confirmadas pelo Paulo. **Estas são as regras do projeto mobile** — qualquer
mudança tem que ser explícita.

1. **Vault no Android:** **App-specific storage** apenas no **MVP de testes**
   (notas descartáveis). Vault REAL só depois do **SAF** implementado. Trava de
   segurança aceita: **não usar notas reais em app-storage** (some ao desinstalar).
2. **Sync PC↔celular:** principal = **pasta no Google Drive via SAF** (permissão
   uma vez), o mais perto possível de automático **sem prometer instantâneo**.
   Plano B = botão **Exportar/Importar vault (.zip)** bem visível.
3. **Conflito de edição:** **criar cópia de conflito** — `Nota.md` +
   `Nota (conflito AAAA-MM-DD).md`. **Nunca** sobrescrever/perder texto.
4. **Git no mobile:** **desativar a aba "Versões"** no MVP (feature flag por
   plataforma). `gix` fica para avaliação futura, se sentir falta.
5. **Distribuição:** **só sideload (APK)** por enquanto. Play Store só se decidir
   distribuir publicamente depois.
6. **minSDK = 26 (Android 8)** / target = API mais recente. Aparelho principal do
   Paulo = Android 14. (Escolha técnica: recursos dependem do WebView atualizável,
   não da API; 26 dá mais alcance sem perder capacidade.)
7. **iOS:** **fora de escopo agora** (só Android). Arquitetura (abstração de FS)
   já deixa a porta aberta pro futuro.

**Itens de ambiente travados:**
- **Caminho com espaços** (`D:\Projetos do Claude\PC - QUARTZO`) **quebra o
  NDK/Gradle**. Solução na F0: **junction** `mklink /J D:\dev\quartzo "D:\Projetos
  do Claude\PC - QUARTZO"` e rodar `tauri android *` a partir de `D:\dev\quartzo`
  (não move nada, não mexe no git; desktop continua buildando no lugar original).
- **rusqlite + ffmpeg** ficam **`#[cfg(desktop)]`** — NÃO compilam no Android
  (PRISMA é 100% desktop). Reduz APK e evita erro de NDK.
- **CodeMirror + teclado virtual:** tratar **se** der problema (não-bloqueador,
  resolve na F1/F4).

**Pronto para iniciar a Fase 0 quando o Paulo der o "go".** (Não iniciar antes.)

---

### Estado atual (referência)

Quartzo desktop em **v0.35** (Tauri 2 + SvelteKit/Svelte 5 + Rust), pasta
`D:\Projetos do Claude\PC - QUARTZO`, crate `lumina`, identifier
`com.quartzo.app`, repo `Paulothedeveloper/quartzo`. `lib.rs` já com
`#[cfg_attr(mobile, tauri::mobile_entry_point)]`. Features togláveis em
`FEATURE_PLUGINS`. i18n PT/EN/ES completa. Integração PRISMA (desktop) e Git/
ffmpeg são os principais pontos desktop-only a tratar no mobile.
