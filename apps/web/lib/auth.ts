import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { config } from "./config";

const secret = new TextEncoder().encode(config.JWT_SECRET);
const alg = "HS256";

export async function hashPassword(pwd: string) {
  return bcrypt.hash(pwd, 10);
}
export async function verifyPassword(pwd: string, hash: string) {
  return bcrypt.compare(pwd, hash);
}
export async function signToken(payload: { id: string; email: string; role: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}
export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { id: string; email: string; role: string; exp: number };
}
export function getTokenFromHeader(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
export async function requireAuth(req: Request): Promise<{ id: string; email: string; role: string }> {
  const token = getTokenFromHeader(req);
  if (!token) throw Object.assign(new Error("未登录"), { status: 401 });
  try {
    const payload = await verifyToken(token);
    return payload as any;
  } catch {
    throw Object.assign(new Error("登录已过期"), { status: 401 });
  }
}
export async function requireAdmin(req: Request) {
  const u = await requireAuth(req);
  if (u.role !== "admin") throw Object.assign(new Error("需要管理员权限"), { status: 403 });
  return u;
}
