"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark, cn, ui } from "@/components/ui";

const field = cn(ui.field, "h-10 w-full max-md:h-11");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const { error: authError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setPending(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    // La misma marca oscura de la barra lateral del panel.
    <main className="grid min-h-dvh place-items-center bg-nav-bg px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark />
          <div>
            <p className="text-[15px] font-semibold text-white">Celebraloo</p>
            <p className="text-xs text-nav-muted">Panel de administración</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-ink-150 bg-surface p-6">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.015em] text-ink-950">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-ink-600">Entra con tu cuenta de Celebraloo.</p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-800">Correo</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error ? true : undefined}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-800">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2 text-danger-700 ring-1 ring-danger-300 ring-inset">
              <CircleAlert size={16} aria-hidden="true" className="mt-px shrink-0" />
              {error}
            </p>
          )}
          <button disabled={pending} className={cn(ui.buttonPrimary, "mt-1 w-full md:h-10")}>
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
