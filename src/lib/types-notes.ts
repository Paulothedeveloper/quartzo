// Tipos de nota (schemas): criam notas com front-matter pré-preenchido, que
// alimentam as views dinâmicas (kanban/tabela/tarefas). Salvos em .quartzo/types.json.
import { get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { currentVaultPath } from "$lib/stores/vault";
import { renamingPath } from "$lib/stores/ui";
import { showToast } from "$lib/stores/toast";
import { openNote, refreshTree } from "$lib/vault-actions";

export interface NoteType {
  id: string;
  name: string;
  emoji: string;
  folder: string;
  frontmatter: Record<string, string>;
  body: string;
}

export const DEFAULT_TYPES: NoteType[] = [
  {
    id: "projeto-video",
    name: "Projeto de vídeo",
    emoji: "🎬",
    folder: "Projetos",
    frontmatter: { tipo: "projeto", status: "Ideia", cliente: "", prazo: "", plataforma: "" },
    body: "## Briefing\n\n## Roteiro\n\n## Feedback\n",
  },
  {
    id: "projeto-design",
    name: "Projeto de design",
    emoji: "🎨",
    folder: "Projetos",
    frontmatter: { tipo: "projeto", status: "Ideia", cliente: "", prazo: "", entrega: "" },
    body: "## Briefing\n\n## Referências\n\n## Entregas\n",
  },
  {
    id: "cliente",
    name: "Cliente / Pessoa",
    emoji: "👤",
    folder: "Pessoas",
    frontmatter: { tipo: "pessoa", empresa: "", contato: "" },
    body: "## Sobre\n\n## Histórico\n",
  },
  {
    id: "reuniao",
    name: "Reunião",
    emoji: "🗓️",
    folder: "Reuniões",
    frontmatter: { tipo: "reuniao", data: "{{date}}", participantes: "" },
    body: "## Pauta\n\n## Decisões\n\n## Próximos passos\n",
  },
  {
    id: "snippet",
    name: "Snippet de código",
    emoji: "💻",
    folder: "Snippets",
    frontmatter: { tipo: "snippet", lang: "", tags: "" },
    body: "```\n\n```\n",
  },
];

function typesPath(vault: string): string {
  return `${vault}/.quartzo/types.json`;
}

/** Carrega os tipos do vault; semeia com os padrões na 1ª vez. */
export async function loadNoteTypes(vault: string): Promise<NoteType[]> {
  try {
    const raw = await invoke<string>("read_file", { path: typesPath(vault) });
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as NoteType[];
  } catch {
    /* arquivo não existe ainda */
  }
  // semeia os padrões
  await saveNoteTypes(vault, DEFAULT_TYPES).catch(() => {});
  return DEFAULT_TYPES;
}

export async function saveNoteTypes(vault: string, types: NoteType[]): Promise<void> {
  await invoke("create_note_full", {
    vault,
    folder: ".quartzo",
    baseName: "__tmp",
    content: "",
  }).catch(() => {}); // garante que .quartzo existe (ignora o tmp)
  await invoke("write_file", { path: typesPath(vault), content: JSON.stringify(types, null, 2) });
}

function applyVars(s: string, title: string): string {
  const now = new Date();
  return s
    .replace(/\{\{\s*date\s*\}\}/gi, now.toISOString().slice(0, 10))
    .replace(/\{\{\s*time\s*\}\}/gi, now.toTimeString().slice(0, 5))
    .replace(/\{\{\s*title\s*\}\}/gi, title);
}

function buildContent(t: NoteType, title: string): string {
  const fm = Object.entries(t.frontmatter)
    .map(([k, v]) => `${k}: ${applyVars(v, title)}`)
    .join("\n");
  const front = fm ? `---\n${fm}\n---\n\n` : "";
  return `${front}# ${title}\n\n${applyVars(t.body, title)}`;
}

/** Cria uma nota a partir de um tipo e abre (em modo renomear). */
export async function createTypedNote(t: NoteType): Promise<void> {
  const vault = get(currentVaultPath);
  if (!vault) {
    showToast("Abra um vault primeiro", "info");
    return;
  }
  const title = `Novo ${t.name}`;
  try {
    const path = await invoke<string>("create_note_full", {
      vault,
      folder: t.folder,
      baseName: title,
      content: buildContent(t, title),
    });
    await refreshTree();
    await openNote(path);
    renamingPath.set(path);
  } catch (e) {
    showToast(`Erro ao criar nota: ${e}`, "error");
  }
}
