# Phase 2 · Unified Soren Memory

完成日期：2026-09-14。目标是让所有 Chat 共享同一个 Soren 身份与长期记忆，同时在 Ombre Brain 离线时保持可用。

## Context 结构

每轮上下文按固定顺序构建：

`Soren Identity / Core → Relevant Shared Memory → Conversation-local Context → Project Context → Runtime State`

- Persona 文件只从全局 `data/persona/` 读取，不再在新会话中复制一份身份或完整 `breath`。
- 最近 8 条消息构成会话局部上下文；它不会成为其他 Chat 的长期记忆。
- 当前消息每轮都通过 MemoryService 做相关召回，Ombre 使用 `mode=automatic`，遵守其 `dont_surface` 与 `digested` 规则。
- Project 记忆只在关联项目中优先召回；Core 和 pinned 记忆可以跨 Chat 保持稳定。

旧字段 `conversations.memory_context` 暂时保留以兼容已有数据库，但新会话不再写入，Turn Context 也不再读取它。

## 双层 MemoryService

Ombre Brain 仍是主要外部记忆引擎；SQLite `memory_records` 是 Soren 的本地索引与离线缓冲层。明确要求“记住”时，内容先按正文指纹 upsert 到本地，再写入 Ombre：

- 在线成功：记录 Ombre bucket ID，状态为 `synced`。
- Ombre 离线或调用失败：正文仍保存在本地，状态为 `failed`，搜索和跨 Chat 召回继续可用。
- 相同正文采用标准化 SHA-256 指纹，重复手动写入或 Seed 导入不会复制记录。
- Soren 只在用户明确要求记住时持久化 Chat 内容，普通对话不会自动整段入库。

## Memory Seed

`POST /api/memory/seed/preview` 只解析和验证，不写入；`POST /api/memory/seed/import` 执行 upsert。支持：

- JSON 数组，或 `{ "memories": [...] }` / `{ "items": [...] }`。
- 使用 `---` 分隔的 Markdown 块；首行 Markdown 标题作为记忆标题。
- 字段：`title`、`content`、`scope`、`projectId`、`importance`、`pinned`、`provenance`。
- 单次最多 500 条，单条正文最多 20000 字符；预览会标记已存在的正文。

## Memory UI

Memory 页面现在显示人类可读的共享记忆列表、范围、重要度、固定状态、来源与同步状态；支持搜索、浮现、手动写入、编辑、固定、归档，以及 Seed 预览和确认导入。界面只呈现 Soren 需要理解的信息，不暴露向量或数据库内部结构。

## API

- `GET /api/memories?q=`：本地共享记忆列表和 Ombre 状态。
- `PATCH /api/memories/:id`：编辑、固定或归档；有 Ombre bucket ID 时同步调用 `trace`。
- `POST /api/memory/breath|search|hold`：统一通过 MemoryService，并返回 `degraded` 状态。
- `POST /api/memory/seed/preview|import`：Seed 两阶段导入。

## 验收

- 自动测试覆盖 Chat A 写入、Chat B 离线召回，以及在线 Ombre bucket 关联。
- Seed 连续导入两次只保留一条本地记录。
- 数据库从 v2 原地升级到 v3，不修改现有 Chat、Workspace、Home Note 或 Ombre 数据。
