import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { areaPermissions, PERMISSIONS } from "@/lib/auth/permissions";

/** Mismo criterio que requireAdmin, incluido el respaldo previo a la migración de roles. */
async function readPermissions(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("admin_my_permissions");
  if (!error) return new Set(((data ?? []) as { permission: string }[]).map((row) => row.permission));
  if (error.code !== "PGRST202" && !/could not find the function/i.test(error.message)) return new Set();
  const { data: row } = await supabase
    .from("celebraloo_staff")
    .select("is_platform_admin, is_super_admin")
    .eq("profile_id", userId)
    .maybeSingle();
  const staff = row as { is_platform_admin: boolean; is_super_admin: boolean } | null;
  return staff?.is_platform_admin && staff.is_super_admin ? new Set(PERMISSIONS) : new Set();
}

/**
 * Refresca la sesión y manda a /login a quien no tiene sesión. Es solo el
 * chequeo optimista: si es admin o no lo decide requireAdmin() en el servidor.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  // /api/cron: sin sesión; la ruta exige CRON_SECRET.
  const isPublic = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/api/cron/");

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Con sesión: quien no tiene rol de panel, o no tiene el permiso de la
  // sección, ve un 404, no un "sin permiso". Es el primer filtro; la regla
  // que manda está en requireAdmin/requirePermission y en cada RPC.
  if (data?.claims && !isPublic) {
    const permissions = await readPermissions(supabase, data.claims.sub);
    const needed = areaPermissions(pathname);
    const allowed = permissions.size > 0 && (!needed || needed.some((permission) => permissions.has(permission)));
    if (!allowed) {
      const notFound = NextResponse.rewrite(new URL("/__no-existe", request.url), { status: 404 });
      response.cookies.getAll().forEach((cookie) => notFound.cookies.set(cookie));
      return notFound;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
