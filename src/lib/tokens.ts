/** Tokens de movimento usados nas transições do Svelte. */
export const motion = {
  duration: { fast: 150, normal: 250, slow: 400 },
  /** easing de entrada (cubic-bezier 0.23,1,0.32,1) como função p/ transições JS. */
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
} as const;
