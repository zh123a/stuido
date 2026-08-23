#!/usr/bin/env node
import { execSync } from "child_process";
const run = (cmd) => { console.log(`$ ${cmd}`); execSync(cmd, { stdio: "inherit" }); };
console.log("== Stuido 生产构建校验 ==");
run("bun --cwd apps/web run build 2>&1 | tail -n 80");
console.log("\n== 构建产物检查 ==");
run("ls -lh apps/web/.next 2>&1 | head -n 20");
run("ls -lh apps/web/renders/*/final_with_audio.mp4 2>&1 | head -n 10");
console.log("\n✓ build-prod 完成，可执行 bun --cwd apps/web run start -p 3000");
