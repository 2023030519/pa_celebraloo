import type { Metadata } from "next";

// La página de login es un componente de cliente y no puede exportar metadata.
export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
