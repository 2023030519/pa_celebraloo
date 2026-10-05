import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSuperAdminPath } from "@/lib/auth/areas";

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
  const isPublic = pathname === "/login" || pathname.startsWith("/auth/");

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Con sesión: quien no es admin (o no es superadmin en las secciones del
  // Panel V1) ve un 404, no un "sin permiso". celebraloo_staff solo es
  // legible para staff (RLS), así que un cliente no obtiene fila.
  if (data?.claims && !isPublic) {
    const { data: staff } = await supabase
      .from("celebraloo_staff")
      .select("is_platform_admin, is_super_admin")
      .eq("profile_id", data.claims.sub)
      .maybeSingle<{ is_platform_admin: boolean; is_super_admin: boolean }>();
    const allowed = staff?.is_platform_admin === true && (!isSuperAdminPath(pathname) || staff.is_super_admin === true);
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
