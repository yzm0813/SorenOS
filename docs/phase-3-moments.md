# Phase 3 · Moments

完成日期：2026-09-16。范围只包含 Moments feed；没有进入统一通知层、CyberDaddy 或自主 Soren Life。

## 用户可见行为

- Home 和主导航都能进入 Moments；有未读 Soren 动态时显示红点和数量。
- 用户可以发布自己的动态，也可以手动触发一条 Soren 动态。
- 动态支持可选地点、评论和针对评论的回复。
- 打开 Moments 后，当前可见的未读动态会被标记为已读。
- Moments 明确为安静的应用内空间，发布不会触发系统或手机通知。

## 数据与规则

- SQLite schema v4 新增 `moments`、`moment_comments` 和 `moment_media`。
- `moment_media` 已保存媒体类型、路径、MIME、大小和时间，为后续图片上传预留；本阶段不开放上传入口。
- 用户发布的动态创建时即为已读；Soren 发布的动态创建未读状态。
- `MomentsService.publishSoren()` 是受控的 Soren 发布入口，未来主动系统复用该入口，不创建第二个 Soren 身份。
- 评论可由用户或 Soren 作者类型写入，并可通过 `replyToCommentId` 回复同一条动态中的评论。

## API

- `GET /api/moments`
- `POST /api/moments`
- `POST /api/moments/:id/comments`
- `POST /api/moments/read`
- `GET /api/home` 的 `moments` 现在返回真实未读数量和 `available: true`。

## 降级与隐私

Moments 完全保存在本地 `data/soren.db`。它不依赖 Codex、Ombre 或 Cyberboss；这些服务离线时 feed 仍可读取和发布。当前代码没有调用通知服务，Phase 3 的测试也确认发布不会产生审计或通知副作用。
