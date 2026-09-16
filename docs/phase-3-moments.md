# Phase 3 · Moments 与持续生活引擎

完成日期：2026-09-16。朋友圈是本地持久化的私人社交空间；页面读取与内容生成彻底分离。

## 用户可见行为

- 用户、Soren 和六位固定好友共享一条朋友圈。
- 动态支持固定头像与昵称、真实发布时间、正文、地点、图片描述占位、点赞、评论和回复。
- 用户可以删除自己的动态；删除使用软删除，重启后不会恢复。
- 点击人物可只看他的朋友圈。
- Soren 与 NPC 发布的新动态产生应用内未读红点；打开后清除，不发送系统或手机通知。
- 时间按真实时间差显示为“刚刚”“N 分钟前”、当天时间、“昨天 HH:mm”或具体日期，不会在重启后重置。

## 固定人物

`social_actors` 保存稳定 ID、昵称、头像、人设、双方关系和最多 20 条简单互动记忆。首次启动只创建人物，不填充假动态。

- `soren`：Soren
- `kevin`：Kevin
- `lin-gong`：林工
- `mori`：Mori
- `ace`：阿策
- `chen-du`：陈渡
- `zhou-yu`：周屿
- `user`：用户本人

## 生成链路

```text
Chat / Workspace / 点赞 / 评论
→ social_events 轻量事件
→ 随机 nextEvaluationAt 到期
→ 本地动机与频率门控
→ CodexSocialGenerator 一次决策
→ none / post / interact / delete
→ 保存 SQLite
→ 页面以后只读取保存结果
```

页面打开、刷新和人物筛选都不会调用模型。Core 每分钟只检查一次持久化的下次评估时间；未到期时不调用模型。首次评估随机安排在 10–45 分钟后，普通评估间隔随机分布，重要事件可以提前唤醒。模型仍可以返回 `none`。

用户发布动态会安排一次 1–20 分钟后的 Soren 反应评估；Soren 仍可按当时状态选择点赞、评论或保持安静。用户评论 Soren 或 NPC 的动态也会进入相同的延迟事件链路。

生成输入包括当前时间、固定人格、角色状态、最近聊天、待处理事件、最近动态、评论与互动历史。提示词要求保护私人聊天、不复制原话、不强制同步、不调用工具，并允许保持沉默。

## 频率与成本控制

- 自动动态每天最多 4 条。
- 非用户自动评论每天最多 12 条。
- 单条动态最多接受 12 条自动评论。
- 同一角色 30 天内不能重复发布相同内容，即使旧内容已删除。
- 每轮最多附带 3 次好友互动。
- 失败后随机退避 1–4 小时，不阻塞 Chat 和朋友圈读取。
- 生成使用独立 Codex thread 和空的 `data/moments-runtime/` 工作目录。

## 持久化

SQLite schema v5 在 Phase 3 表之上新增：

- `social_actors`
- `social_actor_state`
- `social_events`
- `moment_likes`
- 动态作者、图片描述、动机、来源事件、去重指纹和软删除字段
- 评论固定作者字段

旧 Phase 3 动态自动回填 `author_id`，正文和发布时间保持不变。

## API

- `GET /api/moments?actorId=`：读取持久化 feed、人物和未读数，不生成内容。
- `POST /api/moments`：用户发布。
- `DELETE /api/moments/:id`：用户删除自己的动态。
- `POST /api/moments/:id/like`
- `POST /api/moments/:id/comments`
- `POST /api/moments/read`
- `GET /api/moments/life`：读取生活引擎状态。
- `PATCH /api/moments/life`：启用或暂停。
- `POST /api/moments/life/pulse`：诊断用强制评估入口，正常 UI 不调用。

## 运行边界

自主生成只在 Soren Core 运行且 Codex app-server 可用时发生。Codex 离线时，现有朋友圈、点赞与评论仍可正常使用；生活引擎退避后再试。图片目前使用持久化的生活照片描述卡，真实图片上传或图像生成不阻塞动态系统。
