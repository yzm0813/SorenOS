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

打开 `http://127.0.0.1:8787`。Codex app-server 默认使用 `ws://127.0.0.1:8765`，Ombre Brain 默认使用 `http://127.0.0.1:18001/mcp`。

当前架构、已实现范围、API 与数据库迁移基线见 [`docs/phase-0-baseline.md`](docs/phase-0-baseline.md)，Home 的数据与降级规则见 [`docs/phase-1-home.md`](docs/phase-1-home.md)，统一身份、跨 Chat 召回与 Memory Seed 见 [`docs/phase-2-memory.md`](docs/phase-2-memory.md)，本地动态、评论和未读规则见 [`docs/phase-3-moments.md`](docs/phase-3-moments.md)。

## 隐私边界

服务默认只监听 `127.0.0.1`。文件接口只接受项目 ID 和相对路径，并拒绝目录穿越及符号链接；聊天、记忆、附件、日志与 Workspace 文件保存在本机 `data/`。
