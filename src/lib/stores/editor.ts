import { writable, get } from "svelte/store";
import type { EditorView } from "@codemirror/view";

/** View do CodeMirror atualmente montada (null quando não há editor). */
export const activeEditorView = writable<EditorView | null>(null);

/** Insere texto na posição do cursor do editor ativo. Retorna false se não há editor. */
export function insertAtCursor(text: string): boolean {
  const view = get(activeEditorView);
  if (!view) return false;
  view.dispatch(view.state.replaceSelection(text));
  view.focus();
  return true;
}

/** Envolve a seleção com marcadores (ex.: **negrito**). Se não há seleção, posiciona o cursor no meio. */
export function wrapSelection(before: string, after: string = before): boolean {
  const view = get(activeEditorView);
  if (!view) return false;
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: before + sel + after },
    selection: { anchor: from + before.length, head: from + before.length + sel.length },
  });
  view.focus();
  return true;
}

/** Liga/desliga um prefixo nas linhas da seleção (ex.: "# ", "- ", "> ", "- [ ] "). */
export function toggleLinePrefix(prefix: string): boolean {
  const view = get(activeEditorView);
  if (!view) return false;
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  const changes: { from: number; to?: number; insert: string }[] = [];
  for (let n = startLine.number; n <= endLine.number; n++) {
    const line = view.state.doc.line(n);
    if (line.text.startsWith(prefix)) {
      changes.push({ from: line.from, to: line.from + prefix.length, insert: "" });
    } else {
      changes.push({ from: line.from, insert: prefix });
    }
  }
  view.dispatch({ changes });
  view.focus();
  return true;
}
