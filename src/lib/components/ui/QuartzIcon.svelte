<script lang="ts">
  // Ícone vetor de um cristal de quartzo (prisma hexagonal com ponta).
  // Usa currentColor p/ herdar a cor do contexto (ex.: hover do menu).
  let { size = 16, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linejoin="round"
  stroke-linecap="round"
  aria-hidden="true"
>
  <!-- corpo do cristal: prisma com ponta superior -->
  <path d="M12 2 L17 8 L17 19 L12 22 L7 19 L7 8 Z" />
  <!-- face superior (perspectiva da ponta) -->
  <path d="M7 8 L12 11 L17 8" />
  <!-- aresta central -->
  <path d="M12 11 L12 22" />
</svg>
