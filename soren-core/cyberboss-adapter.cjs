const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const cyberbossRoot = path.resolve(__dirname, '../../integrations/cyberboss');
const { resolveDueAtMs } = require(path.join(cyberbossRoot, 'src/services/reminder-service.js'));
const { WhereaboutsService } = require(path.join(cyberbossRoot, 'node_modules/whereabouts-mcp'));

class CyberbossAdapter {
  constructor({ stateDir }) {
    this.stateDir = stateDir;
    this.remindersFile = path.join(stateDir, 'soren-reminders.json');
    this.inboxFile = path.join(stateDir, 'soren-inbox.json');
    this.timelineFile = path.join(stateDir, 'soren-timeline.json');
    fs.mkdirSync(stateDir, { recursive: true });
    this.whereabouts = new WhereaboutsService({
      config: {
        storeFile: path.join(stateDir, 'locations.json'),
        historyLimit: 1000,
        movementEventLimit: 100,
        batteryHistoryLimit: 1000,
        knownPlaces: [],
        knownPlaceRadiusMeters: 150,
        stayMergeRadiusMeters: 100,
        stayBreakConfirmRadiusMeters: 200,
        stayBreakConfirmSamples: 2,
        majorMoveThresholdMeters: 1000
      }
    });
  }

  status() {
    return { configured: true, connected: true, mode: 'soren-channel' };
  }

  listReminders() {
    return this.readList(this.remindersFile).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  }

  createReminder({ text, delay = '', delayMinutes, at = '', dueAt = '', important = false, importance = 0 }) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) throw new Error('提醒内容不能为空');
    const dueAtMs = resolveDueAtMs({ delay, delayMinutes, at, dueAt });
    if (!Number.isFinite(dueAtMs) || dueAtMs <= Date.now()) throw new Error('提醒时间必须晚于现在');
    const reminders = this.readList(this.remindersFile);
    const reminder = { id: crypto.randomUUID(), text: normalizedText, dueAt: new Date(dueAtMs).toISOString(), createdAt: new Date().toISOString(), deliveredAt: null, important: Boolean(important) || Number(importance) >= 8 };
    reminders.push(reminder);
    this.writeList(this.remindersFile, reminders);
    this.addTimeline({ kind: 'reminder', title: '创建提醒', detail: normalizedText });
    return reminder;
  }

  pollDue() {
    const now = Date.now();
    const reminders = this.readList(this.remindersFile);
    const due = reminders.filter(item => !item.deliveredAt && Date.parse(item.dueAt) <= now);
    if (!due.length) return [];
    const deliveredAt = new Date().toISOString();
    for (const item of due) item.deliveredAt = deliveredAt;
    this.writeList(this.remindersFile, reminders);
    const inbox = this.readList(this.inboxFile);
    for (const item of due) {
      inbox.push({ id: crypto.randomUUID(), kind: 'reminder', text: item.text, createdAt: deliveredAt, sourceId: item.id });
      this.addTimeline({ kind: 'reminder-fired', title: '提醒已触发', detail: item.text });
    }
    this.writeList(this.inboxFile, inbox);
    return due;
  }

  listInbox() {
    return this.readList(this.inboxFile).slice(-100);
  }

  addTimeline({ kind = 'event', title, detail = '' }) {
    const items = this.readList(this.timelineFile);
    const event = { id: crypto.randomUUID(), kind, title: String(title || '').trim(), detail: String(detail || '').trim(), createdAt: new Date().toISOString() };
    items.push(event);
    this.writeList(this.timelineFile, items.slice(-1000));
    return event;
  }

  listTimeline() {
    return this.readList(this.timelineFile).slice(-100).reverse();
  }

  ingestDevice(payload) {
    const point = this.whereabouts.appendPoint(payload);
    this.addTimeline({ kind: 'device', title: '收到手机状态', detail: point?.address || point?.appName || '设备状态已更新' });
    return point;
  }

  deviceSnapshot() {
    return this.whereabouts.getSnapshot({ stayLimit: 5, moveLimit: 5 });
  }

  readList(file) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  writeList(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }
}

module.exports = { CyberbossAdapter };
