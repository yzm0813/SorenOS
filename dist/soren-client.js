(() => {
  const DEFAULT_URL = 'http://127.0.0.1:8787';
  const labels = {
    codex: ['Codex Runtime', '负责对话、模型与工具调用'],
    ombre: ['Ombre Brain', '长期记忆与检索'],
    cyberboss: ['Cyberboss', '定时任务、主动消息与设备桥接'],
    games: ['Game MCP', '小游戏房间与操作工具'],
    music: ['Music MCP', '共同播放与歌单控制']
  };
  const state = { baseUrl: localStorage.getItem('soren_core_url') || DEFAULT_URL, services: {} };
  const seenInbox = new Set(JSON.parse(localStorage.getItem('soren_seen_inbox') || '[]'));
  const el = id => document.getElementById(id);
  const modal = el('connectionsModal');
  const normalizeUrl = value => value.trim().replace(/\/$/, '');
  const serviceLabel = service => service.connected ? '已连接' : service.configured ? '暂不可达' : '待配置';

  function renderServices() {
    el('serviceList').innerHTML = Object.entries(labels).map(([key, [name, description]]) => {
      const service = state.services[key] || { connected: false, configured: false };
      return `<div class="service"><b>${name}</b><span class="service-state ${service.connected ? 'ready' : ''}">${serviceLabel(service)}</span><small>${description}</small></div>`;
    }).join('');
    el('gamesState').textContent = state.services.games?.connected ? 'Game MCP connected' : '等待连接游戏 MCP';
    el('musicState').textContent = state.services.music?.connected ? 'Music connected' : '等待连接音乐服务';
  }
  function setCoreStatus(online) {
    el('coreDot').classList.toggle('online', online);
    el('coreStatusText').textContent = online ? 'Soren Core · connected' : 'Soren Core · disconnected';
  }
  async function request(path, options = {}, timeout = 5000) {
    const response = await fetch(`${state.baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: AbortSignal.timeout(timeout)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `连接失败（${response.status}）`);
    return payload;
  }
  async function connect(value = state.baseUrl, notify = false) {
    state.baseUrl = normalizeUrl(value || DEFAULT_URL);
    el('coreUrl').value = state.baseUrl;
    try {
      const data = await request('/api/bootstrap');
      state.services = data.services || {};
      localStorage.setItem('soren_core_url', state.baseUrl);
      setCoreStatus(true);
      renderServices();
      if (notify) showToast('Soren Core 已连接');
      return true;
    } catch {
      state.services = {};
      setCoreStatus(false);
      renderServices();
      if (notify) showToast('未找到 Soren Core，请先在本机启动');
      return false;
    }
  }
  function openConnections() {
    modal.hidden = false;
    el('coreUrl').value = state.baseUrl;
    renderServices();
    el('coreUrl').focus();
  }
  function closeConnections() { modal.hidden = true; }
  async function getModels() {
    const data = await request('/api/models', {}, 20000);
    const models = Array.isArray(data.models) ? data.models : [];
    window.SorenUI.setModels(models);
    return models;
  }
  async function sendChat(message, options = {}) {
    try {
      const data = await request('/api/chat/send', { method: 'POST', body: JSON.stringify({ message, model: options.model || '', effort: options.effort || '' }) }, 10 * 60_000);
      return data.reply;
    } catch (error) {
      if (error.name === 'TimeoutError' || error instanceof TypeError) {
        setCoreStatus(false);
        throw new Error('Soren Core 没有连接。点左下角的 Soren 设置连接地址。');
      }
      throw error;
    }
  }
  async function refreshMemory(notify = true) {
    try {
      const data = await request('/api/memory/breath', { method: 'POST', body: '{}' });
      el('memoryContent').textContent = data.content || 'Ombre 已连接，目前还没有留下长期记忆。';
      if (notify) showToast('Ombre 记忆已更新');
    } catch (error) {
      el('memoryContent').textContent = error.message || 'Ombre 暂时不可用';
    }
  }
  async function refreshTimeline() {
    try {
      const data = await request('/api/timeline');
      const events = data.events || [];
      el('timelineContent').innerHTML = events.length ? events.map(event => {
        const time = new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return `<div class="event"><time>${time}</time><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.detail || '')}</p></div>`;
      }).join('') : '<div class="event"><time>NOW</time><h3>时间线已经连接</h3><p>新的提醒、手机状态和主动事件会从这里开始记录。</p></div>';
    } catch {}
  }
  async function pollInbox() {
    if (!el('coreDot').classList.contains('online')) return;
    try {
      const data = await request('/api/inbox');
      for (const message of data.messages || []) {
        if (seenInbox.has(message.id)) continue;
        seenInbox.add(message.id);
        window.SorenUI.addMessage(message.text);
      }
      const ids = [...seenInbox].slice(-200);
      localStorage.setItem('soren_seen_inbox', JSON.stringify(ids));
    } catch {}
  }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  el('connectionsBtn').addEventListener('click', openConnections);
  el('settingsBtn').addEventListener('click', openConnections);
  el('coreStatus').addEventListener('click', openConnections);
  el('coreStatus').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openConnections(); });
  el('connectionsClose').addEventListener('click', closeConnections);
  modal.addEventListener('click', event => { if (event.target === modal) closeConnections(); });
  el('connectForm').addEventListener('submit', async event => { event.preventDefault(); await connect(el('coreUrl').value, true); });
  el('memoryRefresh').addEventListener('click', () => refreshMemory());
  el('timelineRefresh').addEventListener('click', refreshTimeline);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeConnections(); });

  window.SorenCore = { connect, sendChat, getModels, openConnections, get baseUrl() { return state.baseUrl; } };
  connect().then(online => { if (online) { refreshMemory(false); refreshTimeline(); pollInbox(); getModels().catch(() => {}); } });
  setInterval(pollInbox, 15000);
})();
