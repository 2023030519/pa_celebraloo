"use client";

import { useState, useTransition } from "react";
import { setAdminRole, type AdminRole } from "@/app/(admin)/usuarios/actions";

export function RoleSelect({ userId, role }: { userId: string; role: AdminRole }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-start gap-1">
      <select
        aria-label="Rol"
        value={role}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as AdminRole;
          setError(null);
          startTransition(async () => {
            const result = await setAdminRole(userId, next);
            if (!result.ok) setError(result.message);
          });
        }}
        className="h-8 rounded-md border border-ink-250 bg-surface px-2 text-xs font-semibold outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30 disabled:opacity-50"
      >
        <option value="superadmin">Superadmin</option>
        <option value="admin">Admin</option>
        <option value="none">Ninguno</option>
      </select>
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </span>
  );
}
