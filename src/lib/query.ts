// Views dinâmicas a partir do front-matter das notas (tipo Dataview, local-first).
// O índice é montado no Rust (build_query_index) e as views são renderizadas no preview.
import { writable, get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";

export interface QueryTask {
  text: string;
  checked: boolean;
  line: number;
}
export interface QueryNote {
  path: string;
  name: string;
  folder: string;
  props: Record<string, string[]>;
  tags: string[];
  tasks: QueryTask[];
}

export const queryIndex = writable<QueryNote[]>([]);
let loadedFor = "";

/** Carrega/atualiza o índice do vault (cacheado por vault; force=true reindexar). */
export async function loadQueryIndex(vault: string | null, force = false): Promise<void> {
  if (!vault) {
    queryIndex.set([]);
    loadedFor = "";
    return;
  }
  if (!force && loadedFor === vault && get(queryIndex).length) return;
  try {
    const data = await invoke<QueryNote[]>("build_query_index", { vaultPath: vault });
    queryIndex.set(data);
    loadedFor = vault;
  } catch {
    queryIndex.set([]);
  }
}

export type QueryView = "table" | "board" | "list" | "tasks" | "cards";
export type WhereOp = "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "exists";
export interface QueryConfig {
  view: QueryView;
  folder?: string;
  tag?: string;
  whereKey?: string;
  whereOp?: WhereOp;
  whereVal?: string;
  group: string;
  fields: string[];
  sort?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
}

/** Quebra "campo op valor" (ou "campo=valor") em {key, op, val}. */
export function parseWhere(v: string): { key: string; op: WhereOp; val: string } {
  const word = v.match(/^(.+?)\s+(contains|exists)\b\s*(.*)$/i);
  if (word) {
    return { key: word[1].trim(), op: word[2].toLowerCase() as WhereOp, val: word[3].trim().toLowerCase() };
  }
  for (const op of ["!=", ">=", "<=", ">", "<", "="] as const) {
    const i = v.indexOf(op);
    if (i >= 0) return { key: v.slice(0, i).trim(), op, val: v.slice(i + op.length).trim().toLowerCase() };
  }
  return { key: v.trim(), op: "exists", val: "" };
}

export function parseQueryConfig(text: string): QueryConfig {
  const cfg: QueryConfig = { view: "table", group: "status", fields: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === "view") cfg.view = (["table", "board", "list", "tasks", "cards"].includes(v) ? v : "table") as QueryView;
    else if (k === "folder" || k === "from") cfg.folder = v;
    else if (k === "tag") cfg.tag = v.replace(/^#/, "");
    else if (k === "group") cfg.group = v || "status";
    else if (k === "fields") cfg.fields = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "sort") {
      const parts = v.split(/\s+/);
      cfg.sort = parts[0];
      cfg.sortDir = parts[1]?.toLowerCase() === "desc" ? "desc" : "asc";
    } else if (k === "limit") cfg.limit = parseInt(v, 10) || undefined;
    else if (k === "where") {
      const w = parseWhere(v);
      cfg.whereKey = w.key;
      cfg.whereOp = w.op;
      cfg.whereVal = w.val;
    }
  }
  return cfg;
}

function first(n: QueryNote, key: string): string {
  return n.props[key]?.[0] ?? "";
}

export function filterNotes(index: QueryNote[], cfg: QueryConfig): QueryNote[] {
  let res = index.slice();
  if (cfg.folder) {
    const f = cfg.folder.replace(/^\/|\/$/g, "").toLowerCase();
    res = res.filter((n) => n.folder.toLowerCase() === f || n.folder.toLowerCase().startsWith(f + "/"));
  }
  if (cfg.tag) {
    const tg = cfg.tag.toLowerCase();
    res = res.filter((n) => n.tags.some((t) => t.toLowerCase() === tg));
  }
  if (cfg.whereKey) {
    const op = cfg.whereOp ?? "=";
    const target = cfg.whereVal ?? "";
    res = res.filter((n) => {
      const vals = (n.props[cfg.whereKey!] ?? []).map((v) => v.toLowerCase());
      if (op === "exists") return vals.length > 0;
      if (op === "!=") return !vals.some((v) => v === target);
      if (!vals.length) return false;
      return vals.some((v) => {
        switch (op) {
          case "=":
            return v === target;
          case "contains":
            return v.includes(target);
          case ">":
          case "<":
          case ">=":
          case "<=": {
            const a = parseFloat(v);
            const b = parseFloat(target);
            const cmp = !isNaN(a) && !isNaN(b) ? a - b : v.localeCompare(target);
            if (op === ">") return cmp > 0;
            if (op === "<") return cmp < 0;
            if (op === ">=") return cmp >= 0;
            return cmp <= 0;
          }
          default:
            return v === target;
        }
      });
    });
  }
  res.sort((a, b) => {
    const cmp = cfg.sort ? first(a, cfg.sort).localeCompare(first(b, cfg.sort)) : a.name.localeCompare(b.name);
    return cfg.sortDir === "desc" ? -cmp : cmp;
  });
  if (cfg.limit) res = res.slice(0, cfg.limit);
  return res;
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function head(count: number, noun = "resultado"): HTMLElement {
  return el("div", "q-qhead", `${count} ${noun}${count === 1 ? "" : "s"}`);
}
function link(n: QueryNote, cls = "q-qlink"): HTMLElement {
  const a = el("a", cls, n.name);
  a.setAttribute("data-qopen", n.path);
  return a;
}
function chips(n: QueryNote, field: string, into: HTMLElement) {
  const vals = n.props[field] ?? [];
  if (!vals.length) {
    into.appendChild(el("span", "q-qempty", "—"));
    return;
  }
  for (const v of vals) into.appendChild(el("span", "q-qchip", v));
}

/** Constrói a view a partir do texto de config + índice. Retorna um <div.q-query>. */
export function buildQueryView(text: string, index: QueryNote[]): HTMLElement {
  const cfg = parseQueryConfig(text);
  const wrap = el("div", "q-query");
  wrap.setAttribute("data-qcfg", encodeURIComponent(text));

  if (cfg.view === "tasks") {
    const notes = filterNotes(index, cfg).filter((n) => n.tasks.length);
    let count = 0;
    const cont = el("div", "q-qtasks");
    for (const n of notes) {
      const grp = el("div", "q-qtask-grp");
      grp.appendChild(link(n, "q-qtask-file"));
      for (const t of n.tasks) {
        count++;
        const row = el("label", "q-qtask");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = t.checked;
        cb.setAttribute("data-qtask-path", n.path);
        cb.setAttribute("data-qtask-line", String(t.line));
        row.appendChild(cb);
        row.appendChild(el("span", "q-qtask-text" + (t.checked ? " done" : ""), t.text));
        grp.appendChild(row);
      }
      cont.appendChild(grp);
    }
    wrap.appendChild(head(count, "tarefa"));
    if (!count) cont.appendChild(el("div", "q-qempty-msg", "Nenhuma tarefa encontrada."));
    wrap.appendChild(cont);
    return wrap;
  }

  const notes = filterNotes(index, cfg);

  if (cfg.view === "board") {
    const gk = cfg.group;
    const groups = new Map<string, QueryNote[]>();
    for (const n of notes) {
      const g = n.props[gk]?.[0] ?? "—";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(n);
    }
    const board = el("div", "q-qboard");
    for (const [g, items] of groups) {
      const col = el("div", "q-qcol");
      const h = el("div", "q-qcol-h");
      h.appendChild(el("span", "q-qcol-title", g));
      h.appendChild(el("span", "q-qcol-count", String(items.length)));
      col.appendChild(h);
      for (const n of items) {
        const card = el("div", "q-qcard");
        card.appendChild(link(n));
        const extra = el("div", "q-qcard-meta");
        for (const f of cfg.fields) {
          if (f === gk) continue;
          for (const v of n.props[f] ?? []) extra.appendChild(el("span", "q-qchip", v));
        }
        if (extra.childNodes.length) card.appendChild(extra);
        col.appendChild(card);
      }
      board.appendChild(col);
    }
    wrap.appendChild(head(notes.length));
    if (!notes.length) wrap.appendChild(el("div", "q-qempty-msg", "Nenhuma nota encontrada."));
    else wrap.appendChild(board);
    return wrap;
  }

  if (cfg.view === "list") {
    const ul = el("ul", "q-qlist");
    for (const n of notes) {
      const li = el("li");
      li.appendChild(link(n));
      const f = cfg.fields[0];
      const vals = f ? n.props[f] ?? [] : [];
      if (vals.length) li.appendChild(el("span", "q-qmuted", " · " + vals.join(", ")));
      ul.appendChild(li);
    }
    wrap.appendChild(head(notes.length));
    if (!notes.length) wrap.appendChild(el("div", "q-qempty-msg", "Nenhuma nota encontrada."));
    else wrap.appendChild(ul);
    return wrap;
  }

  if (cfg.view === "cards") {
    const grid = el("div", "q-qcards");
    for (const n of notes) {
      const card = el("div", "q-qcardg");
      card.appendChild(link(n, "q-qcardg-title"));
      const meta = el("div", "q-qcardg-meta");
      for (const f of cfg.fields) {
        const row = el("div", "q-qcardg-row");
        row.appendChild(el("span", "q-qcardg-k", f));
        const vbox = el("span", "q-qcardg-v");
        chips(n, f, vbox);
        row.appendChild(vbox);
        meta.appendChild(row);
      }
      if (meta.childNodes.length) card.appendChild(meta);
      grid.appendChild(card);
    }
    wrap.appendChild(head(notes.length));
    if (!notes.length) wrap.appendChild(el("div", "q-qempty-msg", "Nenhuma nota encontrada."));
    else wrap.appendChild(grid);
    return wrap;
  }

  // table (padrão)
  const fields = cfg.fields.length ? cfg.fields : ["status"];
  const table = el("table", "q-qtable");
  const thead = el("thead");
  const trh = el("tr");
  trh.appendChild(el("th", undefined, "Nota"));
  for (const f of fields) trh.appendChild(el("th", undefined, f));
  thead.appendChild(trh);
  table.appendChild(thead);
  const tb = el("tbody");
  for (const n of notes) {
    const tr = el("tr", "q-qrow");
    const tdName = el("td");
    tdName.appendChild(link(n));
    tr.appendChild(tdName);
    for (const f of fields) {
      const td = el("td");
      chips(n, f, td);
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  wrap.appendChild(head(notes.length));
  if (!notes.length) wrap.appendChild(el("div", "q-qempty-msg", "Nenhuma nota encontrada."));
  else wrap.appendChild(table);
  return wrap;
}
