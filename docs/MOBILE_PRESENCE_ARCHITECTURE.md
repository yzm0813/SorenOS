# Mobile Presence & Push

Phase 5.7A 的链路是：`CyberDaddy / 主动事件 → EventService → Chat 消息 + system notification → 持久化 delivery queue → SystemNotificationProvider → WebPushNotificationProvider → Service Worker → 设备通知`。Chat 和领域事件先成功落库，Push 后送达；网络失败不会撤销 Chat。

`SystemNotificationProvider` 隔离了通知领域与具体通道。第一版实现标准 Web Push，未来更换 APNs、FCM、ntfy 或 Gotify 时，不需要改 CyberDaddy 或 EventService。每个 `notification + subscription` 只有一条 delivery，临时失败最多尝试三次，404/410 会停用失效设备。subscription endpoint、密钥只存本地 SQLite，不写日志；VAPID 私钥只来自环境变量。

通知类型严格分离。Home Note 和 Moment 只产生应用内状态；主动 Soren Chat、CyberDaddy follow-up、重要 reminder 在设置开启时同时产生 Chat 与 system channel。推送正文复用写入 Chat 的同一条文字，发送者始终显示 Soren，payload 只含通知 ID、类型、短正文、会话/消息 ID、深链和时间。

PWA 由 `manifest.webmanifest`、静态 shell cache 与 Service Worker 构成。API 从不缓存；离线时只能打开最近缓存的外壳，不能发送 Chat。点击通知会优先聚焦已打开的 SorenOS，并进入对应会话。Badging API 可用时显示 badge，不支持时静默降级。

Core 仍只监听 `127.0.0.1:8787`。这能安全支持同一台电脑的 PWA，但手机不能直接访问电脑 localhost。当前也没有局域网鉴权和受信任 HTTPS，所以没有把 Core 改绑 `0.0.0.0`。真机入口需要下一小阶段提供 HTTPS 反向代理、设备认证和受限网络访问；公网不得直接暴露 Core API。
