import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-please-change-32b+");

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login?next=/admin");
  try {
    const { payload } = await jwtVerify(token, secret);
    if ((payload as any).role !== "admin") redirect("/");
  } catch {
    redirect("/login?next=/admin");
  }
  return (
    <div className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-56 border-r border-white/10 p-4 shrink-0">
        <div className="font-bold text-lg">Stuido 管理后台</div>
        <nav className="mt-6 space-y-1 text-sm">
          <a href="/admin" className="block px-3 py-2 rounded-lg hover:bg-white/10">总览</a>
          <a href="/admin/users" className="block px-3 py-2 rounded-lg hover:bg-white/10">用户管理</a>
          <a href="/admin/channels" className="block px-3 py-2 rounded-lg hover:bg-white/10">接口通道</a>
          <a href="/admin/projects" className="block px-3 py-2 rounded-lg hover:bg-white/10">项目管理</a>
          <a href="/" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/60">← 返回前台</a>
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
