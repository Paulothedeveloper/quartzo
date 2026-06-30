<script lang="ts">
  // Inter variável EMBUTIDA (woff2 via bundle) — no Windows o WebView caía em
  // Segoe UI; agora a métrica projetada é garantida (regra do Manual).
  import "@fontsource-variable/inter";
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
