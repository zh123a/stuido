import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-please-change-32b+");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  // 仅保护列表与管理接口，单项目相关由 API 内部按 owner 校验（支持公开分享链接）
  const isProtectedApi = pathname.startsWith("/api/admin") || (pathname === "/api/projects" && req.method === "GET");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  // 公开：首页、登录、注册、健康检查、创建项目、单项目查询/预览
  if (
    pathname === "/" ||
    isAuthPage ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/projects" && req.method === "POST" ||
    pathname.match(/^\/api\/projects\/[^/]+$/) ||
    pathname.match(/^\/api\/projects\/[^/]+\/(status|preview)$/) ||
    pathname.startsWith("/api/models") ||
    pathname.startsWith("/api/video")
  ) {
    return NextResponse.next();
  }

  const token =
    req.cookies.get("token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    null;

  if ((isAdmin || isProtectedApi) && !token) {
    if (isAdmin && !pathname.startsWith("/api/")) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
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
      // 已登录访问 /login 则按 next 跳转
      if (isAuthPage) {
        const next = req.nextUrl.searchParams.get("next") || "/";
        return NextResponse.redirect(new URL(next, req.url));
      }
      return NextResponse.next();
    } catch {
      if (isAdmin || isProtectedApi) {
        if (isAdmin && !pathname.startsWith("/api/")) {
          const loginUrl = new URL("/login", req.url);
          loginUrl.searchParams.set("next", pathname);
          return NextResponse.redirect(loginUrl);
        }
        return NextResponse.json({ error: "登录已过期" }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/projects/:path*", "/login", "/register"],
};
