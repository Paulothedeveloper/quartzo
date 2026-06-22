<script lang="ts">
  // Injeta os CSS Snippets habilitados como <style data-qsnippet> no <head>.
  import { untrack } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { settings } from "$lib/stores/settings";
  import { currentVaultPath } from "$lib/stores/vault";

  interface CssSnippet {
    name: string;
    content: string;
  }
  let all = $state<CssSnippet[]>([]);

  // Carrega os arquivos do vault (recarrega ao trocar de vault).
  $effect(() => {
    const v = $currentVaultPath;
    if (!v) {
      all = [];
      return;
    }
    untrack(async () => {
      try {
        all = await invoke<CssSnippet[]>("list_css_snippets", { vaultPath: v });
      } catch {
        all = [];
      }
    });
  });

  // (Re)injeta sempre que a lista de habilitados ou o conteúdo mudar.
  $effect(() => {
    const enabled = $settings.enabledSnippets;
    const map = new Map(all.map((s) => [s.name, s.content]));
    if (typeof document === "undefined") return;
    document.head.querySelectorAll("style[data-qsnippet]").forEach((e) => e.remove());
    for (const name of enabled) {
      const css = map.get(name);
      if (css == null) continue;
      const el = document.createElement("style");
      el.setAttribute("data-qsnippet", name);
      el.textContent = css;
      document.head.appendChild(el);
    }
  });
</script>
