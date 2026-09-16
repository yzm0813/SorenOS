# Phase 4 · 事件与通知层

完成日期：2026-09-16。Home、Moments、主动 Chat 和重要提醒现在先写入统一事件，再由中央规则决定投递位置。

## 固定投递规则

| 事件 | 应用内 | Chat | 系统通知 |
| --- | --- | --- | --- |
| `home_note.created` | Home | 否 | 否 |
| `moment.created` | Moments 与红点 | 否 | 否 |
| `assistant.proactive_message` | 事件记录 | 是 | 用户启用时 |
| `reminder.important` | 事件记录 | 是 | 用户启用时 |

朋友圈和 Home 不会请求系统通知。普通提醒只记录为应用内事件；重要提醒才进入 Chat 与系统通道。全局“主动功能暂停”会拒绝新的主动 Chat 消息。

## 数据与幂等

SQLite schema v6 新增：

- `domain_events`：事件事实、来源、负载、发生时间和唯一 `dedupe_key`。
- `notifications`：每个事件的投递通道、状态、Chat 目标、送达与阅读时间。

同一个 `dedupe_key + delivery_channel` 只能存在一次。主动 Chat 重试不会重复写消息；系统通知关闭时仍保存 `suppressed` 记录，方便解释为什么没有弹出。

状态包括 `pending / delivered / read / suppressed`。Settings 的“事件与通知诊断”显示最近事件和投递结果，不展示私密推理或文件正文。

## API

- `GET /api/events`
- `GET /api/notifications?channel=&status=`
- `POST /api/notifications/:id/delivered`
- `POST /api/notifications/:id/read`
- `POST /api/proactive/messages`

主动消息写入普通 Chat 历史，默认使用持久化的“Soren 主动消息”会话。若调用方提供已有 `conversationId`，则进入指定会话。浏览器只在用户同时打开 Settings 开关并授予浏览器权限后消费 `system` 通道；不会主动弹出权限请求。

## 后续边界

本阶段提供的是 Phase 5 CyberDaddy 和未来手机端共用的投递基础，不实现监督强度、承诺跟进、安静时间或移动推送服务。
