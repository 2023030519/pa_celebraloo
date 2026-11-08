export type Theme = "system" | "light" | "dark";

/** Valor de la cookie "theme"; cualquier otra cosa sigue al sistema. */
export function themeFrom(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
