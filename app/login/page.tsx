"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <main className="grid min-h-dvh place-items-center p-6">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-ink-150 bg-surface p-6 shadow-sm"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-800">Celebraloo</p>
          <h1 className="mt-1 text-xl font-semibold">Panel de administración</h1>
          <p className="mt-1 text-ink-600">Entra con tu cuenta de Celebraloo.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-800">Correo</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 rounded-md border border-ink-250 bg-surface px-3 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-800">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 rounded-md border border-ink-250 bg-surface px-3 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-danger-100 px-3 py-2 text-danger-700">
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="h-10 rounded-md bg-ink-950 font-semibold text-surface transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
