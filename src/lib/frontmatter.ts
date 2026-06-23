// Edição do front-matter (YAML "Propriedades") de uma nota.
// Mantém o corpo intacto; só reescreve o bloco --- ... --- do topo.

export interface FmField {
  key: string;
  value: string;
}

// Captura o bloco de front-matter no início do arquivo (com BOM opcional).
const FM_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export interface FmParse {
  fields: FmField[];
  hasFm: boolean;
  /** índice onde começa o corpo (após o bloco de front-matter). */
  bodyIndex: number;
}

export function parseFm(content: string): FmParse {
  const m = FM_RE.exec(content);
  if (!m) return { fields: [], hasFm: false, bodyIndex: 0 };
  const fields: FmField[] = [];
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    // linhas de continuação de lista YAML ("  - item") viram uma lista em linha
    // [a, b] — que continua sendo YAML válido (não vira string solta).
    if (/^\s+-\s/.test(line) && fields.length) {
      const prev = fields[fields.length - 1];
      const item = line.replace(/^\s+-\s/, "").trim();
      prev.value =
        prev.value && prev.value.endsWith("]")
          ? prev.value.replace(/\]$/, `, ${item}]`)
          : `[${item}]`;
      continue;
    }
    const i = line.indexOf(":");
    if (i < 0) {
      fields.push({ key: line.trim(), value: "" });
    } else {
      fields.push({ key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    }
  }
  return { fields, hasFm: true, bodyIndex: m[0].length };
}

export function serializeFm(fields: FmField[]): string {
  const lines = fields
    .filter((f) => f.key.trim())
    .map((f) => `${f.key.trim()}: ${f.value}`.replace(/\s+$/, ""));
  return `---\n${lines.join("\n")}\n---\n`;
}

/** Devolve o conteúdo inteiro com o front-matter substituído pelos campos dados. */
export function applyFm(content: string, fields: FmField[]): string {
  const p = parseFm(content);
  const body = content.slice(p.bodyIndex);
  const valid = fields.filter((f) => f.key.trim());
  if (valid.length === 0) {
    // sem campos → remove o front-matter por completo
    return body.replace(/^\r?\n/, "");
  }
  return serializeFm(valid) + body;
}
