import { NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // ログイン画面は未ログインでも表示可能
  if (pathname === "/login") {
    return response;
  }

  // ログインしていない場合はログイン画面へ
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);

    // セッション更新時のCookieを引き継ぐ
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
