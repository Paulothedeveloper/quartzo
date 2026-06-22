# Integração · Integration

Como o **Quartzo** se conecta ao ecossistema (PRISMA, VELVET, DaVinci Resolve).
*How **Quartzo** connects to the ecosystem.*

> Papéis · Roles: **QUARTZO ensina COMO · PRISMA diz COM O QUÊ · a IA decide · VELVET aplica.**

## Visão geral · Overview

```
QUARTZO  (notas .md: CST, LUTs, fluxo, briefings)
   │  vault = pasta compartilhada
   ▼
PRISMA   (assets/DAM) — lê o vault como Base de Conhecimento (RAG) e cita as notas no plano de cor
   │  FCPXML + plano de cor
   ▼
DaVinci Resolve  ←  VELVET aplica a cor (LUT por humor, vinda do catálogo do PRISMA)
```

## Quartzo ↔ PRISMA (hoje · today)

Integração de **menor atrito**, sem servidor: **pasta de vault compartilhada**.

1. No Quartzo: **Configurações › Integrações** → "Usar este vault no PRISMA" (copia o caminho).
2. No PRISMA: **Configurações › IA e busca › Base de conhecimento** → cole o caminho.
3. O PRISMA **reindexa ao vivo** (watcher) e passa a **citar as suas notas** nos planos de cor.

Dica: deixe o vault numa **pasta da nuvem** (Quartzo › Configurações › Nuvem) e aponte o PRISMA do notebook e do desktop para ela — conhecimento sincronizado entre máquinas.

O Quartzo também **lança o PRISMA** (Configurações › Integrações › Abrir PRISMA), detectando o executável instalado.

## Contrato de dados · Data contract

- **Vault:** arquivos `.md` (UTF-8). Front-matter YAML simples (`chave: valor` / listas). Wikilinks `[[Nota]]`.
- **PRISMA** consome o vault via os comandos `set_vault_path` / `reindex_vault` / `search_vault` (chunks por heading `##`/`###`).
- Identificadores: Quartzo `com.quartzo.app` · PRISMA `com.paulo.prisma`.

## Roadmap da integração · Integration roadmap

- **Deep link `quartzo://` e `prisma://`** — abrir uma nota/asset direto de um app no outro (exige registrar o scheme nos dois apps).
- **Anexar asset do PRISMA a uma nota** do Quartzo (referência por hash/caminho), com backlink "notas que citam este asset".
- **Sincronização de tags/coleções** entre os dois catálogos.

> Tudo local-first: a ponte é por **arquivos e pasta compartilhada**, nunca por nuvem de terceiros.
