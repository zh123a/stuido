import { db, users, projects, apiKeyChannels } from "@/lib/db";

export default async function AdminHome() {
  const [userCount] = await db.select().from(users).then((r) => [{ count: r.length }]);
  const [projectCount] = await db.select().from(projects).then((r) => [{ count: r.length }]);
  const [channelCount] = await db.select().from(apiKeyChannels).then((r) => [{ count: r.length }]);
  return (
    <div>
      <h1 className="text-2xl font-bold">总览</h1>
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="rounded-2xl bg-[#1a1a1e] border border-white/10 p-6">
          <div className="text-sm text-white/60">用户总数</div>
          <div className="text-3xl font-black mt-2">{userCount.count}</div>
        </div>
        <div className="rounded-2xl bg-[#1a1a1e] border border-white/10 p-6">
          <div className="text-sm text-white/60">项目总数</div>
          <div className="text-3xl font-black mt-2">{projectCount.count}</div>
        </div>
        <div className="rounded-2xl bg-[#1a1a1e] border border-white/10 p-6">
          <div className="text-sm text-white/60">通道总数</div>
          <div className="text-3xl font-black mt-2">{channelCount.count}</div>
        </div>
      </div>
      <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60">后续可扩展：近7日调用、费用、队列看板（BullMQ）。</div>
    </div>
  );
}
