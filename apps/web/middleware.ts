import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-please-change-32b+");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isProtectedApi = pathname.startsWith("/api/projects") || pathname.startsWith("/api/admin");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  // 公开：首页、登录、注册、健康检查
  if (pathname === "/" || isAuthPage || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token =
    req.cookies.get("token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    null;

  if ((isAdmin || isProtectedApi) && !token) {
    if (isAdmin && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  if (token && (isAdmin || isProtectedApi || isAuthPage)) {
    try {
      const { payload } = await jwtVerify(token, secret);
      // admin 校验
      if (isAdmin && (payload as any).role !== "admin") {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
        return NextResponse.redirect(new URL("/", req.url));
      }
      // 已登录访问 /login 则跳首页
      if (isAuthPage) return NextResponse.redirect(new URL("/", req.url));
      return NextResponse.next();
    } catch {
      if (isAdmin || isProtectedApi) {
        if (isAdmin && !pathname.startsWith("/api/")) return NextResponse.redirect(new URL("/login", req.url));
        return NextResponse.json({ error: "登录已过期" }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/projects/:path*", "/login", "/register"],
};
