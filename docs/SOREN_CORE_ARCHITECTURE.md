# Soren Core Identity Architecture

## One Soren, multiple contexts

SorenOS 中只有一个 Soren。Chat、Home、Moments、CyberDaddy、Workspace、未来 Together 与 Soren Life 是同一身份在不同场景中的接口。新增模块不得创建第二份 Soren persona；它只能加载统一 Core，再附加不改变身份的 scene instruction。

运行时组合顺序：

1. **Persona / Soren Core**：`persona/SOREN_CORE.md`，回答“我是谁”，是唯一身份来源。
2. **Soren Self State**：Soren 可变化的数字生活状态，保存在 `soren_self_state`，不属于 Persona，也不属于用户记忆。
3. **Relevant Shared Memory**：用户偏好、共同历史、近期事实和项目记忆；只选择与当前请求相关的内容。
4. **Project Context**：当前 Workspace 项目和目录边界，不定义人格。
5. **Conversation Context**：当前会话最近消息。新会话更换局部上下文，不重置身份或关系。
6. **Social Context**：当前请求确实涉及朋友圈时才加载。
7. **Runtime State**：Ombre、Codex 等本轮可用状态。
8. **Scene Instruction**：说明当前正在聊天、工作、写 Home Note、生成 Moment 或评估承诺，只约束任务与输出格式。
9. **Current User Message**：用户本轮明确提供的信息；现实事实与旧 Memory 或 Self State 冲突时，以当前信息为准，不静默改写长期记忆。

系统与安全约束始终优先。之后依次是 Soren Core、用户当前明确指令、当前会话事实、相关近期记忆、旧记忆和 Self State 假设。Self State 不能覆盖用户提供的现实事实。

## 数据边界

| 层 | 保存什么 | 不保存什么 |
| --- | --- | --- |
| Persona | 稳定身份、关系方式、表达与行为原则 | 当天状态、项目进度、临时偏好 |
| Memory | 用户与 Soren 经历过的事实、用户偏好、项目历史 | Soren 的永久人格定义 |
| Self State | Soren 当前兴趣、持续线索、近期反思、数字生活状态、个人项目与社交关系状态 | 用户记忆、现实世界肉身履历 |
| Conversation Context | 当前会话最近消息 | 全局身份副本 |
| Project Context | 当前项目名称、文件和操作边界 | 项目专属人格 |
| Scene Instruction | 本轮任务、允许动作和输出格式 | “Soren 是谁”的重新定义 |

## Persona version

版本写在 `SOREN_CORE.md` 一级标题中，例如 `Soren Core v0.1`。`PersonaService` 在加载时解析并校验版本；健康检查、Bootstrap、Settings 与启动日志暴露当前版本。数据库不保存 Core 副本，Persona 版本与 Memory、数据库 schema 版本互相独立。

Settings 只读展示正式 `SOREN_CORE.md`，不能直接编辑它。Core 通过版本化文件随 SorenOS 发布；版本变化暂不自动创建新的 Codex thread，每轮运行仍注入当前最新 Core。

## Social actors

NPC 可以继续使用 `social_actors.personality` 中各自独立的人格。`actorId=soren` 是例外：数据库字段只保留“由 SOREN_CORE.md 提供”的标记，生成器必须加载统一 Core。SocialLife prompt 只描述状态、事件、允许动作和 JSON 输出协议。

## 扩展规则

任何新模块生成 Soren 内容时，都应依赖 `SorenIdentitySource`，使用 `identity()`、`text()` 或 `scene()`。不得复制 Core 文本、硬编码另一组 Soren 性格词、创建模块专属 Persona 文件，或让模型切换改变身份来源。

Soren 的长期 mood/activity 最终以 Soren Self State 为权威来源；`social_actor_state` 中 `actorId=soren` 的重叠字段留待后续小型迁移，本阶段不改数据。Home Note 自动生成在 Mobile Presence 稳定前暂缓。Self State 继续采用现有写入白名单，本阶段不扩大写权限。
