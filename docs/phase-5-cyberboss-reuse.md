# Phase 5 · Cyberboss 复用审查

审查日期：2026-09-16。结论：Cyberboss 作为工程参考和少量基础代码来源，不作为 SorenOS 内的第二个智能体运行。

## KEEP

- `reminder-service.js` 的相对时间、绝对时间解析与合法性检查。
- reminder queue 的按到期时间排序、一次取出到期项和重复触发保护思路。
- JSON 状态文件的临时文件写入后原子替换方式，继续用于尚未迁移的旧提醒数据。
- pulse / heartbeat 思路：单个周期循环寻找到期工作，不为每条任务创建长期计时器。
- Codex RPC 传输适配器；它已经由 `packages/runtime-codex` 复用。

## ADAPT

- 调度状态迁入 Soren 的 SQLite，由数据库事务保存承诺、下次允许跟进时间和历史。
- 微信 system message 改为 Phase 4 的 `EventService`，由中央规则投递到普通 Chat 与可选系统通知。
- reminder 到期后再投递；创建提醒时只记录创建事件。
- 轮询从账号、发送者和微信上下文改成 Soren 的监督领域、承诺和来源会话。
- 去重从队列 ID 扩展为 `commitment + follow-up sequence + delivery channel`。
- 评估器读取近期 Chat 上下文，在疲惫、疾病或家庭急事等情况下缩小任务或暂缓追问。

## REMOVE

- 微信登录、账号绑定、消息同步和媒体通道。
- 独立 Cyberboss / CyberDaddy persona、单独身份或单独署名。
- 羞辱、KPI、公开排名和与 Soren 人格冲突的固定语气。
- 当前阶段的手机位置、前台 App 和设备监控触发。
- Claude Code runtime、贴纸、截图队列及与监督闭环无关的工具。

CyberDaddy 在产品内只是一组经过用户授权的 Soren 能力：`Soren Core → supervision capability → EventService → Soren Chat`。
