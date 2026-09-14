# Phase 1 · Home

完成日期：2026-09-14。范围只包含 Home；未实现 Moments 内容、系统通知、手机定位或后续主动功能。

## 用户看到的行为

- Home 是默认入口，日期在页面上方安静显示。
- Soren Note 持久保存在 SQLite；“在 Chat 里回应”会切换到 Chat，并把 Note 作为引用草稿放入输入框，不自动发送。
- Today 最多显示 4 条来自最近 Chat、最近 Workspace、当前 Cyberboss 提醒和最近 Timeline 的内容，并可进入对应页面。
- Moments 卡片已经接收 `unreadCount` 并显示红点，但 Phase 3 前保持“即将开放”，不会产生系统通知。
- 天气城市由用户在 Settings 中搜索、选择并保存；系统不读取设备定位，也不预设用户所在城市。
- 天气没有配置或服务不可达时，Home 使用明确的安静状态，其他内容照常加载。

## 数据与接口

- SQLite schema v2 新增 `home_notes`；更新 Note 会归档旧 Note，Home 始终读取最新未归档记录。
- `GET /api/home` 返回 Note、天气、Today 和 Moments 未读状态。
- `PUT /api/home/note` 是未来主动 Soren 系统写入 Home Note 的内部边界；它只写 Home 数据，不调用通知服务。
- `GET /api/weather/locations?q=` 提供城市候选；选中的完整坐标和时区对象通过现有 Settings API 保存为 `weatherLocation`。
- `WeatherProvider` 是可替换接口；当前实现使用无需密钥的 Open-Meteo 地理编码与预报 API，并在 Core 内缓存成功结果 10 分钟。官方接口说明：[Geocoding API](https://open-meteo.com/en/docs/geocoding-api)、[Weather Forecast API](https://open-meteo.com/en/docs)。

## 验收

- 新旧数据库迁移到 v2 后，既有会话和项目保持不变。
- Home Note 跨数据库重启保持同一 ID 和内容，且不会生成审计或系统通知记录。
- Open-Meteo 响应通过适配器归一化；失败由 Home API 转为 `unavailable` 状态。
- Home、Note 回应、Settings 城市搜索、Chat 和 Workspace 均经过本地生产构建验证。
