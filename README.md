# Soren OS

Soren OS 是一个本地优先的私人聊天与创作空间。第一阶段主链路是：

`React Chat → Soren Core → Codex app-server → Workspace / Git → Ombre Brain`

## 目录

- `apps/web`：React、TypeScript 和 Vite 前端。
- `apps/core`：本地 HTTP/SSE 服务、SQLite 索引和模块编排。
- `packages/runtime-codex`：Codex app-server 适配器。
- `packages/workspace`：真实文件、路径保护和 Git 版本。
- `packages/memory`：Ombre Brain 调用策略。
- `packages/mcp-client`：MCP HTTP 客户端。
- `packages/shared`：前后端共享类型与事件协议。
- `soren-core`：旧版适配器，迁移期间保留，其中 Cyberboss 仍由新版 Core 复用。

Ombre Brain 与 Cyberboss 的源码位于本仓库同级的 `integrations/`。私人运行数据位于同级的 `data/`，不会提交到 Git。

## 本地运行

要求 Node.js 24、pnpm 11、Git，以及已安装的 Codex CLI。

```powershell
pnpm install
pnpm --filter @soren/web build
pnpm --filter @soren/core dev
```

打开 `http://127.0.0.1:8787`。Core 会检查仅监听 `ws://127.0.0.1:8765` 的 Codex app-server：已有实例会被复用，没有实例则随 Core 启动并在 Core 关闭时清理。Ombre Brain 默认使用 `http://127.0.0.1:18001/mcp`。

## PWA 与系统通知

复制 `.env.example` 为 `.env`，用 `pnpm --filter @soren/core exec web-push generate-vapid-keys` 生成一对 VAPID keys，并填写 `SOREN_VAPID_PUBLIC_KEY`、`SOREN_VAPID_PRIVATE_KEY` 与 `SOREN_VAPID_SUBJECT`。`.env` 已被 Git 忽略，私钥不得提交。重启 Core 后，在 `Settings → 通知` 中由用户主动连接设备并发送测试通知。

当前 Core 只监听 localhost；安全边界、手机真机前置条件和操作说明见 [`docs/MOBILE_PRESENCE_ARCHITECTURE.md`](docs/MOBILE_PRESENCE_ARCHITECTURE.md) 与 [`docs/MOBILE_TEST_GUIDE.md`](docs/MOBILE_TEST_GUIDE.md)，常驻方案比较见 [`docs/ALWAYS_ON_PRESENCE_PLAN.md`](docs/ALWAYS_ON_PRESENCE_PLAN.md)。

### 可信家庭 Wi-Fi 真机测试

默认启动仍只监听 `127.0.0.1`。需要临时进行同网手机测试时，依次运行：

```powershell
pnpm lan:setup
pnpm lan:status
pnpm lan:start
```

`lan:setup` 为当前私人 LAN IP 生成本地 CA 和 HTTPS 证书，`lan:status` 检查 IP 是否变化，`lan:start` 才会显式启用 `SOREN_LAN_MODE=true`，并启动 Chat 所需的本机 Codex app-server。电脑继续使用 `http://127.0.0.1:8787`，手机使用提示的 `https://LAN-IP:8788`；8765 始终只绑定 `127.0.0.1`。该模式没有认证，只能用于可信家庭网络；完整步骤见 [`docs/MOBILE_TEST_GUIDE.md`](docs/MOBILE_TEST_GUIDE.md)，安全债见 [`docs/LAN_SECURITY_DEBT.md`](docs/LAN_SECURITY_DEBT.md)。

当前架构、已实现范围、API 与数据库迁移基线见 [`docs/phase-0-baseline.md`](docs/phase-0-baseline.md)，Home 的数据与降级规则见 [`docs/phase-1-home.md`](docs/phase-1-home.md)，统一身份、跨 Chat 召回与 Memory Seed 见 [`docs/phase-2-memory.md`](docs/phase-2-memory.md)，本地动态、评论和未读规则见 [`docs/phase-3-moments.md`](docs/phase-3-moments.md)，统一事件、投递规则与去重机制见 [`docs/phase-4-events.md`](docs/phase-4-events.md)，Soren 督促、承诺和安静时间见 [`docs/phase-5-cyberdaddy.md`](docs/phase-5-cyberdaddy.md)。Cyberboss 复用边界见 [`docs/phase-5-cyberboss-reuse.md`](docs/phase-5-cyberboss-reuse.md)。

普通 Chat 中的未来任务通过结构化 scheduling action 创建：一次性任务进入 `scheduled_reminders`，到期只提醒一次；需要重复催促或完成跟进的任务进入 CyberDaddy commitment。Core 使用设置中的用户时区（默认 `Asia/Shanghai`）验证时间，只有持久化成功后 Chat 才会确认。Timeline 同时显示两类计划及其来源和状态。

Settings 的通知诊断区分 Web Push 服务接受（`sent`）、Android Service Worker 收到（`received`）和系统通知展示成功（`displayed`）；诊断只保存 notification ID、类型、渠道、provider、尝试次数、时间和安全错误码，不保存或展示 subscription 密钥。

## 隐私边界

服务默认只监听 `127.0.0.1`。文件接口只接受项目 ID 和相对路径，并拒绝目录穿越及符号链接；聊天、记忆、附件、日志与 Workspace 文件保存在本机 `data/`。
