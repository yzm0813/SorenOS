# Phase 0 基线审查

审查日期：2026-09-14  
范围：仅审查、验证、行为不变的结构拆分与数据库迁移基线；未进入 Phase 1。

> 这是 Phase 0 完成时的基线快照；Phase 1 已将数据库继续迁移到 v2，当前状态见 `phase-1-home.md`。

## 当前架构

主链路：`React Web → Soren Core HTTP/SSE → Codex app-server → Workspace/Git`，Core 同时通过 MCP HTTP 调用 Ombre Brain，并复用 `soren-core/cyberboss-adapter.cjs` 读取 Cyberboss 的提醒、Inbox 与 Timeline 数据。

- `apps/web`：聊天、Workspace、Memory、Timeline、Settings 界面。
- `apps/core`：本地 HTTP/SSE 服务、SQLite 元数据与模块编排。
- `packages/runtime-codex`：Codex app-server WebSocket 适配器。
- `packages/workspace`：专属目录、原子写入、路径保护、Git 版本。
- `packages/memory` 与 `packages/mcp-client`：Ombre Brain 策略和 MCP HTTP 客户端。
- `packages/shared`：Conversation、Workspace、权限与 SSE 事件类型。
- `soren-core`：迁移期间保留的旧适配层；新版 Core 当前仍使用其中的 Cyberboss adapter。
- 仓库外同级 `data/`：`soren.db`、Workspace、Persona、附件、日志、Ombre 与 Cyberboss 私人数据。

## 已实现能力

### 已存在

- Chat：多会话、新建、搜索、重命名、归档、Markdown、复制、引用、编辑后重生成、附件、停止生成、模型选择、Thinking 模式与深度。
- Runtime：会话绑定 Codex thread；SSE 已定义文本、公开思考摘要、工具、文件变化、完成和错误事件。
- Workspace：真实项目目录、文件树、Monaco、500ms 自动保存、HTML/Markdown 预览、Preview Console、Diff、History、提交与恢复、Ask Soren。
- Memory：新会话 `breath`、过去信息 `search`、明确记忆 `hold`；Memory 页面可直接调用三种能力。
- MCP/Settings：Ombre 工具发现、权限等级、审计记录、Persona 文件和主动功能总暂停设置。
- Cyberboss：提醒、Inbox、Timeline 的本地 adapter 和 API。

### 部分实现

- Model 的会话默认已存在；“仅本轮模型”仍未形成独立 UI 状态。
- Workspace 文件树展示已存在；筛选输入框尚未绑定筛选行为。
- MCP 注册表目前只注册 Ombre，尚未形成通用多服务器配置加载机制。
- 权限数据和审计已存在，但所有工具调用尚未统一经过权限执行器。
- 附件可进入 Chat/Codex，上层附件浏览、删除和历史详情仍较薄。
- Core 有构建产物，但内部 workspace 包仍直接导出 TypeScript 源码，因此正式 `node dist/server.js` 打包边界尚未闭合；当前可靠启动方式是 `tsx src/server.ts`。

### 尚未实现（Phase 0 不扩展）

- Home、Diary、完整 Moments、Together/游戏、音乐、手机状态、随机主动消息、语音和 Tauri 桌面封装。
- 这些能力按 handoff 的后续阶段处理，本次没有增加入口或占位实现。

## API 与事件基线

核心路由：

- 系统：`GET /api/health`、`GET /api/bootstrap`、`GET /api/models`
- Cyberboss：`GET|POST /api/reminders`、`GET /api/inbox`、`GET /api/timeline`
- Chat：`GET|POST /api/conversations`、`GET|PATCH /api/conversations/:id`
- Turn：`POST /api/conversations/:id/turns`、`POST /api/conversations/:id/turns/:turnId/cancel`
- Workspace：`GET|POST /api/projects`，以及项目详情、文件、预览、提交、历史、Diff、恢复路由
- Memory/MCP：`POST /api/memory/breath|search|hold`、`GET /api/mcp`、`PUT /api/mcp/permissions`
- Settings：`GET|PUT /api/settings`

SSE 事件：`assistant.delta`、`thinking.summary`、`tool.started`、`tool.completed`、`file.changed`、`turn.completed`、`turn.error`。

## 数据库迁移方案

当前 schema 版本为 **1**，由 `apps/core/src/migrations.ts` 管理。迁移器同时维护 SQLite `PRAGMA user_version` 和 `schema_migrations` 记录；旧数据库的表通过 `CREATE ... IF NOT EXISTS` 原地纳入版本 1，不清空、不改写现有行，重复启动不会重复迁移。应用遇到高于自身支持版本的数据库会停止启动，避免旧程序误写新数据。

现有表：`conversations`、`messages`、`turns`、`projects`、`attachments`、`settings`、`tool_permissions`、`audit_logs`，新增迁移记录表 `schema_migrations`。后续每次 schema 变化都增加单调递增迁移；涉及删列、改类型或批量改写时，先备份数据库并在副本上验证，再迁移真实数据。

## Phase 0 结构调整

- 将原先集中在 `apps/web/src/App.tsx` 的五个业务界面拆到 `features/chat`、`features/workspace`、`features/memory`、`features/timeline`、`features/settings`。
- 将 Markdown 渲染抽到 `components/Markdown.tsx`；App 只保留主导航、在线状态和跨页面项目绑定。
- 修正 Core 的静态目录，使其读取 Vite 实际输出的仓库根目录 `dist/`。
- 将旧静态原型验证替换为 React 构建契约验证；`dist/` 确认为可重复生成产物，不再纳入 Git。
- 加入数据库兼容迁移和 Workspace 编辑/版本/恢复/越界保护回归测试。

## 验收边界

Phase 0 通过条件：前后端完整构建成功；构建契约验证成功；迁移在新数据库与带旧记录数据库上均成功且可重复；Workspace 编辑、Diff、提交、恢复及目录穿越拒绝测试成功；现有界面文案、导航和交互意图不变。
