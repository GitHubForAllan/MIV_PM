import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-shXfvnOP-QqJsSu_QDmiO096fPQoxfs",
  authDomain: "miv-1426c.firebaseapp.com",
  projectId: "miv-1426c",
  storageBucket: "miv-1426c.firebasestorage.app",
  messagingSenderId: "398934341623",
  appId: "1:398934341623:web:4af46c057d2e202855a0f2"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

function getProjectId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get("p");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    const url = new URL(window.location.href);
    url.searchParams.set("p", id);
    window.history.replaceState({}, "", url.toString());
  }
  return id;
}
const projectId = getProjectId();
const projectRef = doc(db, "projects", projectId);

// ── 鎖定機制：任務級樂觀鎖 ──────────────────────────────────────
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 分鐘後自動失效

/** 每個瀏覽器 session 產生唯一使用者名稱，存於 localStorage */
const userName = (() => {
  const key = "projectflow.userName.v1";
  let name = localStorage.getItem(key);
  if (!name) {
    const adj  = ["積極", "認真", "勤快", "細心", "熱心"];
    const noun = ["工程師", "PM", "設計師", "主管", "同事"];
    const tag  = Math.random().toString(36).slice(2, 5).toUpperCase();
    name = adj[Math.floor(Math.random() * adj.length)] +
           noun[Math.floor(Math.random() * noun.length)] + "-" + tag;
    localStorage.setItem(key, name);
  }
  return name;
})();

const viewModeKey = "projectflow.viewMode.v1";
const dayMs = 24 * 60 * 60 * 1000;
const timelineWidths = {
  day: 34,
  week: 76,
  month: 200
};

function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const seedTasks = [
  { id: uid(), name: "Office Move Project", owner: "Allan", status: "in-progress", start: "2026-05-25", end: "2026-06-16", progress: 36, level: 0, type: "summary" },
  { id: uid(), name: "Planning", owner: "PM", status: "in-progress", start: "2026-05-25", end: "2026-05-31", progress: 80, level: 1, type: "summary" },
  { id: uid(), name: "Stakeholder interviews", owner: "Mia", status: "done", start: "2026-05-25", end: "2026-05-27", progress: 100, level: 2, type: "task" },
  { id: uid(), name: "Budget approval", owner: "Kai", status: "at-risk", start: "2026-05-28", end: "2026-05-31", progress: 55, level: 2, type: "task" },
  { id: uid(), name: "Execution", owner: "Ops", status: "in-progress", start: "2026-06-01", end: "2026-06-12", progress: 15, level: 1, type: "summary" },
  { id: uid(), name: "Equipment purchasing", owner: "Nora", status: "in-progress", start: "2026-06-01", end: "2026-06-05", progress: 25, level: 2, type: "task" },
  { id: uid(), name: "Network and seating setup", owner: "Leo", status: "in-progress", start: "2026-06-04", end: "2026-06-10", progress: 10, level: 2, type: "task" },
  { id: uid(), name: "Move complete", owner: "PM", status: "milestone", start: "2026-06-12", end: "2026-06-12", progress: 0, level: 2, type: "milestone" },
  { id: uid(), name: "Acceptance check", owner: "Allan", status: "not-started", start: "2026-06-13", end: "2026-06-16", progress: 0, level: 1, type: "task" }
];

const state = {
  tasks: [],
  collapsed: new Set(),
  projectName: "Project schedule",
  viewMode: localStorage.getItem(viewModeKey) || "day",
  editingId: null,
  drag: null,
  suppressClick: false,
  undoStack: [],
  locks: {}   // { [taskId]: { user: string, ts: number } }
};

const els = {
  addTask: document.querySelector("#add-task"),
  projectTitle: document.querySelector("#project-title"),
  expandAll: document.querySelector("#expand-all"),
  collapseAll: document.querySelector("#collapse-all"),
  saveProject: document.querySelector("#save-project"),
  undoButton: document.querySelector("#undo-button"),
  resetProject: document.querySelector("#reset-project"),
  taskList: document.querySelector("#task-list"),
  timelineHeader: document.querySelector("#timeline-header"),
  viewButtons: document.querySelectorAll("[data-view-mode]"),
  ganttBody: document.querySelector("#gantt-body"),
  taskCount: document.querySelector("#task-count"),
  avgProgress: document.querySelector("#avg-progress"),
  projectRange: document.querySelector("#project-range"),
  todayLabel: document.querySelector("#today-label"),
  dialog: document.querySelector("#task-dialog"),
  form: document.querySelector("#task-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  deleteTask: document.querySelector("#delete-task"),
  copyTask: document.querySelector("#copy-task"),
  name: document.querySelector("#task-name"),
  owner: document.querySelector("#task-owner"),
  level: document.querySelector("#task-level"),
  status: document.querySelector("#task-status"),
  start: document.querySelector("#task-start"),
  end: document.querySelector("#task-end"),
  progress: document.querySelector("#task-progress"),
  progressOutput: document.querySelector("#progress-output"),
  depCascade: document.querySelector("#dep-cascade"),
  notes: document.querySelector("#task-notes"),
  isAtRisk: document.querySelector("#task-at-risk"),
  isMilestone: document.querySelector("#task-milestone"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmMessage: document.querySelector("#confirm-message"),
  confirmOk: document.querySelector("#confirm-ok"),
  confirmCancel: document.querySelector("#confirm-cancel"),
  shareProject: document.querySelector("#share-project"),
  importInput: document.querySelector("#import-input")
};


function inferStatus(task) {
  if (task.status) return task.status;
  if (task.type === "milestone") return "milestone";
  if (task.progress >= 100) return "done";
  if (parseDate(task.end) < new Date() && task.progress < 100) return "at-risk";
  if (task.progress > 0) return "in-progress";
  return "not-started";
}

function normalizeTask(task) {
  return {
    ...task,
    deps: task.deps || [],
    notes: task.notes || "",
    changes: task.changes || [],
    status: inferStatus(task)
  };
}

function persist() {
  setDoc(projectRef, {
    tasks: state.tasks,
    projectName: state.projectName,
    collapsed: [...state.collapsed]
  }, { merge: true }).catch(err => console.error("儲存失敗:", err));
  localStorage.setItem(viewModeKey, state.viewMode);
}

/** 更新首頁用的專案清單（存 localStorage） */
function updateProjectRegistry() {
  try {
    const key = "projectflow.registry.v1";
    const registry = JSON.parse(localStorage.getItem(key) || "[]");
    const idx = registry.findIndex(p => p.id === projectId);
    const progress = state.tasks.length
      ? Math.round(state.tasks.reduce((s, t) => s + (t.progress || 0), 0) / state.tasks.length)
      : 0;
    const entry = {
      id:          projectId,
      name:        state.projectName,
      taskCount:   state.tasks.length,
      progress,
      lastVisited: Date.now()
    };
    if (idx >= 0) registry[idx] = entry;
    else registry.unshift(entry);
    localStorage.setItem(key, JSON.stringify(registry.slice(0, 50)));
  } catch { /* ignore */ }
}

// ── 鎖定 / 解鎖 / 狀態查詢 ─────────────────────────────────────
function acquireLock(taskId) {
  const entry = { user: userName, ts: Date.now() };
  state.locks[taskId] = entry;
  updateDoc(projectRef, { [`locks.${taskId}`]: entry })
    .catch(err => console.error("鎖定失敗:", err));
}

function releaseLock(taskId) {
  if (!taskId) return;
  if (state.locks[taskId]?.user !== userName) return;
  delete state.locks[taskId];
  updateDoc(projectRef, { [`locks.${taskId}`]: deleteField() })
    .catch(err => console.error("解鎖失敗:", err));
}

/** 回傳正在鎖定此任務的他人名稱，若無則回傳 null */
function isLockedByOther(taskId) {
  const lock = state.locks[taskId];
  if (!lock) return null;
  if (Date.now() - lock.ts > LOCK_TTL_MS) return null; // 鎖已逾時
  if (lock.user === userName) return null;              // 自己的鎖
  return lock.user;
}

// ── 版次紀錄 ──────────────────────────────────────────────────────
const FIELD_LABELS = {
  start:    "開始日",
  end:      "結束日",
  name:     "名稱",
  status:   "狀態",
  progress: "進度",
  owner:    "負責人"
};

function renderChangeHistory(task) {
  const container = document.querySelector("#change-history");
  if (!container) return;
  const entries = (task?.changes || []).slice().reverse();
  if (!entries.length) {
    container.innerHTML = '<span class="history-empty">尚無紀錄</span>';
    return;
  }
  container.innerHTML = entries.map(e => {
    const d   = new Date(e.at);
    const ts  = `${d.getMonth()+1}/${d.getDate()} `
              + `${String(d.getHours()).padStart(2,"0")}:`
              + `${String(d.getMinutes()).padStart(2,"0")}`;
    const diffs = (e.changes || []).map(c => {
      const lbl = FIELD_LABELS[c.field] || c.field;
      return `<span class="hc-row">
        <span class="hc-field">${lbl}</span>
        <span class="hc-from">${c.from}</span>
        <span class="hc-arrow">→</span>
        <span class="hc-to">${c.to}</span>
      </span>`;
    }).join("");
    return `<div class="h-entry">
      <div class="h-header">
        <span class="h-version">v${e.v}</span>
        <span class="h-who">${e.by}</span>
        <span class="h-when">${ts}</span>
      </div>
      <div class="h-diffs">${diffs}</div>
    </div>`;
  }).join("");
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value) {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function daysBetween(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / dayMs);
}

function addDays(value, amount) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return toIso(date);
}

function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(value) {
  const date = parseDate(value);
  date.setDate(date.getDate() - date.getDay());
  return toIso(date);
}

function endOfWeek(value) {
  const date = parseDate(value);
  date.setDate(date.getDate() + (6 - date.getDay()));
  return toIso(date);
}

function startOfMonth(value) {
  const date = parseDate(value);
  date.setDate(1);
  return toIso(date);
}

function endOfMonth(value) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + 1, 0);
  return toIso(date);
}

function getMonthLabel(value) {
  const date = parseDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekLabel(value) {
  const date = parseDate(value);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
}

function getMonthShortLabel(value) {
  const date = parseDate(value);
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
}

function getTimelineScale(range) {
  if (state.viewMode === "week") return getWeekScale(range);
  if (state.viewMode === "month") return getMonthScale(range);
  return getDayScale(range);
}

function getDayScale(range) {
  const width = timelineWidths.day;
  const totalDays = daysBetween(range.start, range.end) + 1;
  const units = [];

  for (let index = 0; index < totalDays; index += 1) {
    const start = addDays(range.start, index);
    units.push({
      start,
      end: start,
      label: String(parseDate(start).getDate()),
      group: getMonthLabel(start),
      width,
      days: 1
    });
  }

  return { start: range.start, end: range.end, units, width };
}

function getWeekScale(range) {
  const width = timelineWidths.week;
  const start = startOfMonth(range.start);
  const end = endOfMonth(range.end);
  const units = [];
  let cursorDate = parseDate(start);

  while (cursorDate <= parseDate(end)) {
    const monthStart = toIso(cursorDate);
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = daysBetween(monthStart, monthEnd) + 1;

    for (let week = 0; week < 4; week += 1) {
      const startOffset = Math.floor((daysInMonth * week) / 4);
      const endOffset = Math.floor((daysInMonth * (week + 1)) / 4) - 1;
      const unitStart = addDays(monthStart, startOffset);
      const unitEnd = addDays(monthStart, endOffset);

      units.push({
        start: unitStart,
        end: unitEnd,
        label: `W${week + 1}`,
        group: getMonthLabel(monthStart),
        width,
        days: daysBetween(unitStart, unitEnd) + 1
      });
    }

    cursorDate.setMonth(cursorDate.getMonth() + 1, 1);
  }

  return { start, end, units, width };
}

function getMonthScale(range) {
  const width = timelineWidths.month;
  const start = startOfMonth(range.start);
  const end = endOfMonth(range.end);
  const units = [];
  let cursorDate = parseDate(start);

  while (cursorDate <= parseDate(end)) {
    const unitStart = toIso(cursorDate);
    const unitEnd = endOfMonth(unitStart);
    units.push({
      start: unitStart,
      end: unitEnd,
      label: getMonthShortLabel(unitStart),
      group: String(cursorDate.getFullYear()),
      width,
      days: daysBetween(unitStart, unitEnd) + 1
    });
    cursorDate.setMonth(cursorDate.getMonth() + 1, 1);
  }

  return { start, end, units, width };
}

function getScaleGroups(units) {
  const groups = [];
  units.forEach((unit) => {
    const current = groups[groups.length - 1];
    if (current && current.label === unit.group) {
      current.width += unit.width;
    } else {
      groups.push({ label: unit.group, width: unit.width });
    }
  });
  return groups;
}

function getOffsetForDate(scale, value) {
  const dayOffset = Math.max(daysBetween(scale.start, value), 0);

  if (state.viewMode === "day") return dayOffset * timelineWidths.day;

  let offset = 0;
  for (const unit of scale.units) {
    if (parseDate(value) > parseDate(unit.end)) {
      offset += unit.width;
      continue;
    }

    const daysIntoMonth = clamp(daysBetween(unit.start, value), 0, unit.days);
    return offset + (daysIntoMonth / unit.days) * unit.width;
  }

  return offset;
}

function getWidthForRange(scale, start, end) {
  return Math.max(getOffsetForDate(scale, end) - getOffsetForDate(scale, start) + getUnitWidthForDate(scale, end), 8);
}

function getUnitWidthForDate(scale, value) {
  if (state.viewMode === "day") return timelineWidths.day;
  if (state.viewMode === "week") return timelineWidths.week / 7;

  const unit = scale.units.find((item) => parseDate(value) >= parseDate(item.start) && parseDate(value) <= parseDate(item.end));
  return unit ? unit.width / unit.days : timelineWidths.month / 30;
}

function getRange() {
  const starts = state.tasks.map((task) => parseDate(task.start));
  const ends = state.tasks.map((task) => parseDate(task.end));
  const min = new Date(Math.min(...starts));
  const max = new Date(Math.max(...ends));
  min.setDate(min.getDate() - 1);
  max.setDate(max.getDate() + 2);
  return {
    start: toIso(min),
    end: toIso(max)
  };
}

function getBarClass(task, prog = task.progress) {
  const progressClass = prog > 50 ? "progress-over-half" : "";
  const statusClass = `status-${task.status || inferStatus(task)}`;
  if (task.type === "summary") return `summary ${statusClass} ${progressClass}`;
  if (task.type === "milestone") return "milestone";
  return `${statusClass} ${progressClass}`;
}

function getBarLabelClass(width) {
  return width < 44 ? "compact-label" : "";
}

function hasChildren(taskId) {
  const index = getTaskIndex(taskId);
  if (index < 0 || index >= state.tasks.length - 1) return false;
  return state.tasks[index + 1].level > state.tasks[index].level;
}

function getVisibleTasks() {
  const visible = [];
  const hiddenLevels = [];

  state.tasks.forEach((task) => {
    while (hiddenLevels.length && task.level <= hiddenLevels[hiddenLevels.length - 1]) {
      hiddenLevels.pop();
    }

    if (hiddenLevels.length) return;

    visible.push(task);
    if (state.collapsed.has(task.id)) {
      hiddenLevels.push(task.level);
    }
  });

  return visible;
}

function renderSummary(range) {
  const progMap = computeInheritedProgress();
  const avg = Math.round(state.tasks.reduce((sum, task) => sum + progMap[task.id], 0) / state.tasks.length);
  els.taskCount.textContent = String(state.tasks.length);
  els.avgProgress.textContent = `${avg}%`;
  els.projectRange.textContent = `${formatDate(range.start)} - ${formatDate(range.end)}`;
  els.todayLabel.textContent = new Intl.DateTimeFormat("en", { month: "numeric", day: "numeric" }).format(new Date());
}

function propagateAtRiskFlags() {
  let changed = false;
  state.tasks.forEach((task, idx) => {
    if (task.status === "milestone" || task.type === "milestone") return;
    if (!hasChildren(task.id)) return;
    let hasLateDescendant = false;
    for (let i = idx + 1; i < state.tasks.length; i++) {
      if (state.tasks[i].level <= task.level) break;
      if (parseDate(state.tasks[i].end) > parseDate(task.end)) {
        hasLateDescendant = true;
        break;
      }
    }
    if (hasLateDescendant && task.status !== "at-risk") {
      state.tasks[idx] = { ...task, status: "at-risk" };
      changed = true;
    } else if (!hasLateDescendant && task.status === "at-risk") {
      const p = task.progress ?? 0;
      state.tasks[idx] = { ...task, status: p >= 100 ? "done" : p > 0 ? "in-progress" : "not-started" };
      changed = true;
    }
  });
  return changed;
}

function computeInheritedProgress() {
  const result = {};
  for (let i = state.tasks.length - 1; i >= 0; i--) {
    const task = state.tasks[i];
    const children = getDirectChildren(task.id);
    if (!children.length) {
      result[task.id] = task.progress;
    } else {
      const sum = children.reduce((acc, c) => acc + (result[c.id] ?? c.progress), 0);
      result[task.id] = Math.round(sum / children.length);
    }
  }
  return result;
}

function computeTaskNumbers() {
  const counters = [0, 0, 0, 0, 0];
  const numbers = {};
  state.tasks.forEach((task) => {
    const level = task.level;
    counters[level]++;
    for (let l = level + 1; l <= 4; l++) counters[l] = 0;
    numbers[task.id] = level === 0 ? "" : counters.slice(1, level + 1).join(".");
  });
  return numbers;
}

function renderTasks() {
  const numbers = computeTaskNumbers();
  els.taskList.innerHTML = "";
  getVisibleTasks().forEach((task) => {
    const locker = isLockedByOther(task.id);
    const row = document.createElement("div");
    row.className = `task-row task-grid ${task.type} level-${task.level} status-${task.status}${locker ? " row-locked" : ""}`;
    row.draggable = true;
    row.dataset.taskId = task.id;
    const canToggle = hasChildren(task.id);
    const toggleLabel = state.collapsed.has(task.id) ? "+" : "-";
    const numStr = numbers[task.id];
    row.innerHTML = `
      <span class="drag-handle" aria-hidden="true"></span>
      <button type="button" data-edit="${task.id}">
        <span class="task-name">
          <span class="indent" style="width: ${task.level * 10}px"></span>
          <span
            class="tree-toggle ${canToggle ? "" : "placeholder"}"
            data-toggle="${canToggle ? task.id : ""}"
            title="${canToggle ? "Expand or collapse" : ""}"
            aria-label="${canToggle ? "Expand or collapse task" : ""}"
          >${canToggle ? toggleLabel : "."}</span>
          ${numStr ? `<span class="task-number">${numStr}</span>` : ""}
          <span class="task-title"></span>
          ${locker ? `<span class="lock-chip" title="${locker} 正在編輯此任務">🔒 ${locker}</span>` : ""}
        </span>
        <span class="owner"></span>
        <span class="status-badge status-${task.status}">${getStatusLabel(task.status)}</span>
        <span>${formatDate(task.start)}</span>
        <span>${formatDate(task.end)}</span>
      </button>
    `;
    row.querySelector(".task-title").textContent = task.name;
    row.querySelector(".owner").textContent = task.owner;
    els.taskList.append(row);
  });
}

function getStatusLabel(status) {
  const labels = {
    "not-started": "未開始",
    "in-progress": "進行中",
    "at-risk": "有風險",
    done: "已完成",
    milestone: "里程碑"
  };
  return labels[status] || labels["not-started"];
}

function statusClasses() {
  return ["status-not-started", "status-in-progress", "status-at-risk", "status-done", "status-milestone"];
}

function applyLevelSelectStyle() {
  els.level.classList.remove("level-0", "level-1", "level-2", "level-3", "level-4");
  els.level.classList.add(`level-${els.level.value}`);
}

function previewTaskProgress() {
  if (els.progress.disabled) return;
  const value = Number(els.progress.value);
  els.progressOutput.textContent = `${value}%`;
  if (!els.isMilestone.checked) {
    els.status.value = value === 0 ? "not-started" : value === 100 ? "done" : "in-progress";
  }
  if (!state.editingId) return;
  const bar = els.ganttBody.querySelector(`.bar[data-edit="${state.editingId}"]`);
  const barProgress = bar?.querySelector(".bar-progress");
  const barLabel = bar?.querySelector(".bar-label");
  if (barProgress) barProgress.style.width = `${value}%`;
  if (barLabel) barLabel.textContent = `${value}%`;
  if (bar) bar.classList.toggle("progress-over-half", value > 50);
}

function applyStatusSideEffects() {
  if (els.status.value === "done" && !els.progress.disabled) {
    els.progress.value = 100;
    previewTaskProgress();
    return;
  }
  if (els.status.value === "not-started" && !els.progress.disabled) {
    els.progress.value = 0;
    els.progressOutput.textContent = "0%";
  }
  if (!state.editingId) return;
  const effectiveStatus = els.isMilestone.checked ? "milestone" : els.isAtRisk.checked ? "at-risk" : els.status.value;
  const nextClass = `status-${effectiveStatus}`;
  const row = els.taskList.querySelector(`[data-task-id="${state.editingId}"]`);
  const badge = row?.querySelector(".status-badge");
  const bar = els.ganttBody.querySelector(`.bar[data-edit="${state.editingId}"]`);
  if (row) {
    row.classList.remove(...statusClasses());
    row.classList.add(nextClass);
  }
  if (badge) {
    badge.classList.remove(...statusClasses());
    badge.classList.add(nextClass);
    badge.textContent = getStatusLabel(effectiveStatus);
  }
  if (bar) {
    bar.classList.remove(...statusClasses());
    bar.classList.add(nextClass);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTaskIndex(taskId) {
  return state.tasks.findIndex((task) => task.id === taskId);
}

function getTaskBlock(index) {
  const root = state.tasks[index];
  const block = [root];
  for (let next = index + 1; next < state.tasks.length; next += 1) {
    if (state.tasks[next].level <= root.level) break;
    block.push(state.tasks[next]);
  }
  return block;
}

function getIndexAfterBlock(index) {
  return index + getTaskBlock(index).length;
}

function clearDropState() {
  els.taskList.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
    row.classList.remove("drop-before", "drop-after");
  });
}

function getDropInfo(event) {
  const row = event.target.closest(".task-row");
  if (!row) {
    return { index: state.tasks.length, position: "after", row: null };
  }

  const rect = row.getBoundingClientRect();
  const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  const rowIndex = getTaskIndex(row.dataset.taskId);
  return {
    index: position === "after" ? getIndexAfterBlock(rowIndex) : rowIndex,
    position,
    row
  };
}

function getAllowedLevel(tasks, insertIndex, wantedLevel) {
  if (insertIndex <= 0) return 0;
  const previous = tasks[insertIndex - 1];
  return clamp(wantedLevel, 0, Math.min(previous.level + 1, 4));
}

function moveTaskBlock(taskId, insertIndex, wantedLevel) {
  const originalIndex = getTaskIndex(taskId);
  if (originalIndex < 0) return;

  const block = getTaskBlock(originalIndex);
  const blockIds = new Set(block.map((task) => task.id));
  const untouched = state.tasks.filter((task) => !blockIds.has(task.id));
  const insertionInUntouched = state.tasks
    .slice(0, insertIndex)
    .filter((task) => !blockIds.has(task.id)).length;

  const nextLevel = getAllowedLevel(untouched, insertionInUntouched, wantedLevel);
  const levelDelta = nextLevel - block[0].level;
  const movedBlock = block.map((task) => ({
    ...task,
    level: clamp(task.level + levelDelta, 0, 4)
  }));

  state.tasks = [
    ...untouched.slice(0, insertionInUntouched),
    ...movedBlock,
    ...untouched.slice(insertionInUntouched)
  ];
}

function renderTimeline(range) {
  const scale = getTimelineScale(range);
  const totalWidth = scale.units.reduce((sum, unit) => sum + unit.width, 0);
  const columns = scale.units.map((unit) => `${unit.width}px`).join(" ");
  els.timelineHeader.innerHTML = "";
  els.timelineHeader.style.width = `${totalWidth}px`;
  document.querySelector(".timeline-pane").dataset.viewMode = state.viewMode;

  const groupBand = document.createElement("div");
  groupBand.className = "timeline-band";
  const groups = getScaleGroups(scale.units);
  groupBand.style.gridTemplateColumns = groups
    .map((group) => `${group.width}px`)
    .join(" ");

  groups.forEach((group) => {
    const cell = document.createElement("div");
    cell.className = "month-cell";
    cell.textContent = group.label;
    groupBand.append(cell);
  });

  const tickBand = document.createElement("div");
  tickBand.className = "timeline-band";
  tickBand.style.gridTemplateColumns = columns;

  scale.units.forEach((unit) => {
    const cell = document.createElement("div");
    const date = parseDate(unit.start);
    cell.className = `day-cell ${state.viewMode === "day" && [0, 6].includes(date.getDay()) ? "weekend" : ""}`;
    cell.textContent = unit.label;
    cell.title = `${unit.start} - ${unit.end}`;
    tickBand.append(cell);
  });

  els.timelineHeader.append(groupBand, tickBand);

  els.ganttBody.innerHTML = "";
  els.ganttBody.style.width = `${totalWidth}px`;
  els.ganttBody.style.setProperty("--day-width", `${state.viewMode === "day" ? timelineWidths.day : scale.width}px`);

  const visibleTasks = getVisibleTasks();
  const progMap = computeInheritedProgress();
  visibleTasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = `gantt-row level-${task.level}`;
    row.style.width = `${totalWidth}px`;

    const offset = getOffsetForDate(scale, task.start);
    const durationWidth = getWidthForRange(scale, task.start, task.end);
    const bar = document.createElement("button");
    bar.type = "button";
    const barWidth = Math.max(durationWidth - 8, 10);
    const prog = progMap[task.id] ?? task.progress;
    bar.className = `bar ${getBarClass(task, prog)} ${getBarLabelClass(barWidth)}`;
    bar.dataset.edit = task.id;
    bar.style.left = `${offset + 4}px`;
    bar.style.width = `${barWidth}px`;
    bar.title = `${task.name}: ${task.start} - ${task.end}`;

    if (task.type !== "milestone") {
      const progress = document.createElement("span");
      progress.className = "bar-progress";
      progress.style.width = `${prog}%`;

      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = `${prog}%`;

      bar.append(progress, label);
    }

    row.append(bar);
    els.ganttBody.append(row);
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  if (parseDate(todayIso) >= parseDate(scale.start) && parseDate(todayIso) <= parseDate(scale.end)) {
    const today = document.createElement("div");
    today.className = "today-line";
    today.style.left = `${getOffsetForDate(scale, todayIso) + getUnitWidthForDate(scale, todayIso) / 2}px`;
    els.ganttBody.append(today);
  }
  renderDependencyArrows(scale, visibleTasks);
}

function getVisibleAncestorId(taskId, visibleSet) {
  if (visibleSet.has(taskId)) return taskId;
  const path = getTaskAncestorPath(taskId);
  for (let i = path.length - 2; i >= 0; i--) {
    if (visibleSet.has(path[i])) return path[i];
  }
  return null;
}

function renderDependencyArrows(scale, visibleTasks) {
  const ROW_H = 42;
  const BAR_CY = 21;
  const pos = {};
  visibleTasks.forEach((task, i) => {
    const offset = getOffsetForDate(scale, task.start);
    const w = Math.max(getWidthForRange(scale, task.start, task.end) - 8, 10);
    pos[task.id] = { x1: offset + 4, x2: offset + 4 + w, y: i * ROW_H + BAR_CY };
  });

  const visibleSet = new Set(visibleTasks.map((t) => t.id));
  const arrows = [];
  const drawnPairs = new Set();
  state.tasks.forEach((task) => {
    if (!task.deps?.length) return;
    const visibleTaskId = getVisibleAncestorId(task.id, visibleSet);
    if (!visibleTaskId || !pos[visibleTaskId]) return;
    task.deps.forEach((depId) => {
      const visibleDepId = getVisibleAncestorId(depId, visibleSet);
      if (!visibleDepId || visibleDepId === visibleTaskId || !pos[visibleDepId]) return;
      const pairKey = `${visibleDepId}→${visibleTaskId}`;
      if (drawnPairs.has(pairKey)) return;
      drawnPairs.add(pairKey);
      arrows.push({ x1: pos[visibleDepId].x2, y1: pos[visibleDepId].y, x2: pos[visibleTaskId].x1, y2: pos[visibleTaskId].y });
    });
  });

  if (!arrows.length) return;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible";

  const defs = document.createElementNS(NS, "defs");
  const marker = document.createElementNS(NS, "marker");
  marker.id = "dep-arrow";
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "5");
  marker.setAttribute("markerHeight", "5");
  marker.setAttribute("orient", "auto");
  const head = document.createElementNS(NS, "path");
  head.setAttribute("d", "M 0 0 L 8 4 L 0 8 Z");
  head.setAttribute("fill", "#1479b8");
  marker.append(head);
  defs.append(marker);
  svg.append(defs);

  arrows.forEach(({ x1, y1, x2, y2 }) => {
    const elbowX = x1 + 12;
    const d = x2 > elbowX
      ? `M ${x1} ${y1} H ${elbowX} V ${y2} H ${x2}`
      : `M ${x1} ${y1} H ${Math.max(x1, x2) + 20} V ${y2} H ${x2}`;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#1479b8");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-dasharray", "4 2");
    path.setAttribute("marker-end", "url(#dep-arrow)");
    svg.append(path);
  });

  els.ganttBody.append(svg);
}

function render() {
  if (!state.tasks.length) {
    state.tasks = seedTasks;
  }
  if (propagateAtRiskFlags()) persist();
  els.projectTitle.textContent = state.projectName;
  document.title = `${state.projectName} - ProjectFlow`;
  const range = getRange();
  els.viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewMode === state.viewMode);
  });
  renderSummary(range);
  renderTasks();
  renderTimeline(range);
  updateUndoButton();
}

function saveProjectName() {
  const nextName = els.projectTitle.textContent.trim() || "Project schedule";
  state.projectName = nextName.slice(0, 80);
  els.projectTitle.textContent = state.projectName;
  persist();
  document.title = `${state.projectName} - ProjectFlow`;
}

function getLevel0Tasks() {
  return state.tasks.filter((t) => t.level === 0);
}

function getDirectChildren(parentId) {
  const idx = getTaskIndex(parentId);
  if (idx < 0) return [];
  const parentLevel = state.tasks[idx].level;
  const children = [];
  for (let i = idx + 1; i < state.tasks.length; i++) {
    if (state.tasks[i].level <= parentLevel) break;
    if (state.tasks[i].level === parentLevel + 1) children.push(state.tasks[i]);
  }
  return children;
}

function getTaskAncestorPath(taskId) {
  const idx = getTaskIndex(taskId);
  if (idx < 0) return [taskId];
  const path = [taskId];
  let currentLevel = state.tasks[idx].level;
  for (let i = idx - 1; i >= 0 && currentLevel > 0; i--) {
    if (state.tasks[i].level === currentLevel - 1) {
      path.unshift(state.tasks[i].id);
      currentLevel--;
    }
  }
  return path;
}

function createDepSelect(level, tasks, selectedId, excludeId) {
  const sel = document.createElement("select");
  sel.dataset.depLevel = String(level);
  sel.className = "dep-select";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = level === 0 ? "— 選擇前置任務 —" : "— 選擇子項目 —";
  sel.append(empty);
  tasks.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    if (t.id === selectedId) opt.selected = true;
    sel.append(opt);
  });
  sel.addEventListener("change", (e) => onDepSelectChange(e, excludeId));
  return sel;
}

function onDepSelectChange(event, excludeId) {
  const level = Number(event.target.dataset.depLevel);
  [...els.depCascade.querySelectorAll("select")].forEach((s) => {
    if (Number(s.dataset.depLevel) > level) s.remove();
  });
  const selectedId = event.target.value;
  if (!selectedId) return;
  const children = getDirectChildren(selectedId).filter((t) => t.id !== excludeId);
  if (!children.length) return;
  els.depCascade.append(createDepSelect(level + 1, children, "", excludeId));
}

function buildDepCascade(existingDepId, excludeId) {
  els.depCascade.innerHTML = "";
  const level0 = getLevel0Tasks().filter((t) => t.id !== excludeId);
  if (!level0.length) {
    const msg = document.createElement("span");
    msg.className = "dep-empty";
    msg.textContent = "（無可選前置任務）";
    els.depCascade.append(msg);
    return;
  }
  const path = existingDepId ? getTaskAncestorPath(existingDepId) : [];
  let parentTasks = level0;
  let level = 0;
  while (parentTasks.length > 0) {
    const sel = createDepSelect(level, parentTasks, path[level] || "", excludeId);
    els.depCascade.append(sel);
    const selectedId = path[level];
    if (!selectedId) break;
    const children = getDirectChildren(selectedId).filter((t) => t.id !== excludeId);
    if (!children.length) break;
    parentTasks = children;
    level++;
  }
}

function getSelectedDepId() {
  const selects = [...els.depCascade.querySelectorAll("select")];
  for (let i = selects.length - 1; i >= 0; i--) {
    if (selects[i].value) return selects[i].value;
  }
  return null;
}

function openDialog(task = null) {
  if (task) {
    const locker = isLockedByOther(task.id);
    if (locker) {
      alert(`⚠️ 「${task.name}」目前由「${locker}」正在編輯，請稍後再試。`);
      return;
    }
    acquireLock(task.id);
  }
  state.editingId = task?.id ?? null;
  els.dialogTitle.textContent = task ? "編輯任務" : "新增任務";
  els.deleteTask.hidden = !task;
  els.copyTask.hidden = !task;
  els.name.value = task?.name ?? "";
  els.owner.value = task?.owner ?? "";
  els.level.value = String(task?.level ?? 1);
  applyLevelSelectStyle();
  els.start.value = task?.start ?? toIso(new Date());
  els.end.value = task?.end ?? addDays(els.start.value, 3);

  const storedStatus = task?.status ?? "not-started";
  const isMilestone = storedStatus === "milestone" || task?.type === "milestone";
  const isAtRisk = storedStatus === "at-risk";
  els.isMilestone.checked = isMilestone;
  els.isAtRisk.checked = isAtRisk;

  let baseStatus = storedStatus;
  if (isMilestone || isAtRisk) {
    const p = task?.progress ?? 0;
    baseStatus = p >= 100 ? "done" : p > 0 ? "in-progress" : "not-started";
  }
  els.status.value = baseStatus;
  els.status.disabled = isMilestone;

  const isLeaf = task ? !hasChildren(task.id) : true;
  let displayProg = task?.progress ?? 0;
  if (!isLeaf) {
    const pm = computeInheritedProgress();
    displayProg = pm[task.id] ?? task.progress;
  }
  els.progress.value = String(displayProg);
  els.progress.disabled = !isLeaf || isMilestone;
  if (isMilestone) {
    els.progressOutput.textContent = "（里程碑）";
  } else if (isLeaf) {
    els.progressOutput.textContent = `${displayProg}%`;
  } else {
    els.progressOutput.textContent = `${displayProg}%（自動計算）`;
  }
  els.notes.value = task?.notes ?? "";
  buildDepCascade(task?.deps?.[0] ?? null, task?.id ?? null);
  renderChangeHistory(task);
  els.dialog.showModal();
}

function upsertTask() {
  if (parseDate(els.end.value) < parseDate(els.start.value)) {
    els.end.setCustomValidity("結束日期不能早於開始日期。");
    els.end.reportValidity();
    return;
  }

  els.end.setCustomValidity("");
  pushUndo();
  const existing = state.tasks.find((item) => item.id === state.editingId);
  const nextLevel = Number(els.level.value);
  const finalStatus = els.isMilestone.checked ? "milestone" : els.isAtRisk.checked ? "at-risk" : els.status.value;
  const newName    = els.name.value.trim();
  const newOwner   = els.owner.value.trim();
  const newStart   = els.start.value;
  const newEnd     = els.end.value;
  const newProg    = Number(els.progress.value);

  // ── 建立版次紀錄 ────────────────────────────────────────────
  const prevChanges = existing?.changes || [];
  const diffFields  = [];
  if (existing) {
    if (newStart !== existing.start)
      diffFields.push({ field: "start",    from: existing.start,                  to: newStart });
    if (newEnd   !== existing.end)
      diffFields.push({ field: "end",      from: existing.end,                    to: newEnd   });
    if (newName  !== existing.name)
      diffFields.push({ field: "name",     from: existing.name,                   to: newName  });
    if (newOwner !== existing.owner)
      diffFields.push({ field: "owner",    from: existing.owner,                  to: newOwner });
    if (finalStatus !== existing.status)
      diffFields.push({ field: "status",   from: existing.status,                 to: finalStatus });
    if (newProg  !== existing.progress && !hasChildren(existing.id))
      diffFields.push({ field: "progress", from: String(existing.progress) + "%", to: newProg + "%" });
  }
  const newChanges = diffFields.length
    ? [...prevChanges.slice(-19), {
        v:       (prevChanges.at(-1)?.v ?? 0) + 1,
        at:      Date.now(),
        by:      userName,
        changes: diffFields
      }]
    : prevChanges;

  const task = {
    id: state.editingId ?? uid(),
    name:     newName,
    owner:    newOwner,
    status:   finalStatus,
    start:    newStart,
    end:      newEnd,
    progress: newProg,
    level:    nextLevel,
    type: existing?.type === "summary" ? "summary" : els.isMilestone.checked ? "milestone" : "task",
    deps:    getSelectedDepId() ? [getSelectedDepId()] : [],
    notes:   els.notes.value,
    changes: newChanges
  };

  if (state.editingId) {
    const originalIndex = getTaskIndex(state.editingId);
    const blockIds = originalIndex >= 0 ? new Set(getTaskBlock(originalIndex).map((item) => item.id)) : new Set();
    const levelDelta = existing ? nextLevel - existing.level : 0;
    state.tasks = state.tasks.map((item) => {
      if (item.id === state.editingId) return task;
      if (blockIds.has(item.id)) {
        return { ...item, level: clamp(item.level + levelDelta, 0, 4) };
      }
      return item;
    });
  } else {
    state.tasks.push(task);
  }

  persist();
  render();
  els.dialog.close();
}

function pushUndo() {
  state.undoStack.push(JSON.parse(JSON.stringify(state.tasks)));
  if (state.undoStack.length > 20) state.undoStack.shift();
  updateUndoButton();
}

function undo() {
  if (!state.undoStack.length) return;
  state.tasks = state.undoStack.pop();
  persist();
  render();
}

function updateUndoButton() {
  els.undoButton.disabled = state.undoStack.length === 0;
}

function showConfirm(message, onConfirm) {
  els.confirmMessage.textContent = message;
  els.confirmDialog.showModal();

  function handleOk() {
    cleanup();
    onConfirm();
  }
  function handleCancel() {
    cleanup();
  }
  function cleanup() {
    els.confirmDialog.close();
    els.confirmOk.removeEventListener("click", handleOk);
    els.confirmCancel.removeEventListener("click", handleCancel);
  }

  els.confirmOk.addEventListener("click", handleOk);
  els.confirmCancel.addEventListener("click", handleCancel);
}

function copyTaskBlock() {
  const originalIndex = getTaskIndex(state.editingId);
  if (originalIndex < 0) return;
  pushUndo();

  const block = getTaskBlock(originalIndex);

  // 建立舊 ID → 新 ID 的對應表，供 block 內部 deps 重映射
  const idMap = {};
  block.forEach((task) => { idMap[task.id] = uid(); });

  const copied = block.map((task, i) => ({
    ...task,
    id: idMap[task.id],
    name: i === 0 ? `${task.name}（複製）` : task.name,
    deps: (task.deps || []).map((depId) => idMap[depId] ?? depId)
  }));

  const insertAt = originalIndex + block.length;
  state.tasks = [
    ...state.tasks.slice(0, insertAt),
    ...copied,
    ...state.tasks.slice(insertAt)
  ];

  persist();
  render();
  els.dialog.close();
}

els.expandAll.addEventListener("click", () => {
  state.collapsed.clear();
  persist();
  render();
});
els.collapseAll.addEventListener("click", () => {
  state.tasks.forEach((task) => {
    if (hasChildren(task.id)) state.collapsed.add(task.id);
  });
  persist();
  render();
});
els.addTask.addEventListener("click", () => openDialog());
els.projectTitle.addEventListener("blur", saveProjectName);
els.projectTitle.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    els.projectTitle.blur();
  }
});
els.saveProject.addEventListener("click", () => {
  saveProjectName();
  persist();
  els.saveProject.textContent = "✓";
  setTimeout(() => {
    els.saveProject.textContent = "S";
  }, 900);
});
els.resetProject.addEventListener("click", () => {
  state.undoStack = [];
  state.tasks = seedTasks.map((task) => ({ ...task, id: uid() }));
  state.collapsed = new Set();
  state.projectName = "Project schedule";
  persist();
  render();
});
els.importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.tasks) || !data.tasks.length) throw new Error("找不到任務資料");
      pushUndo();
      state.tasks = data.tasks.map(normalizeTask);
      state.projectName = data.projectName || state.projectName;
      state.collapsed = new Set(data.collapsed || []);
      persist();
      render();
      alert(`✅ 匯入成功：${state.tasks.length} 個任務已上傳至 Firestore`);
    } catch (err) {
      alert("匯入失敗：" + err.message);
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});
els.shareProject.addEventListener("click", () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    els.shareProject.textContent = "✓";
    setTimeout(() => { els.shareProject.textContent = "⇪"; }, 1500);
  });
});
els.progress.addEventListener("input", () => {
  previewTaskProgress();
});
els.level.addEventListener("change", applyLevelSelectStyle);
els.status.addEventListener("change", applyStatusSideEffects);
els.isMilestone.addEventListener("change", () => {
  if (els.isMilestone.checked) {
    els.isAtRisk.checked = false;
    els.status.disabled = true;
    els.progress.disabled = true;
    els.progressOutput.textContent = "（里程碑）";
  } else {
    els.status.disabled = false;
    const isLeaf = !state.editingId || !hasChildren(state.editingId);
    els.progress.disabled = !isLeaf;
    els.progressOutput.textContent = isLeaf ? `${els.progress.value}%` : `${els.progress.value}%（自動計算）`;
  }
});
els.isAtRisk.addEventListener("change", () => {
  if (els.isAtRisk.checked) {
    els.isMilestone.checked = false;
    els.status.disabled = false;
    const isLeaf = !state.editingId || !hasChildren(state.editingId);
    els.progress.disabled = !isLeaf;
    els.progressOutput.textContent = isLeaf ? `${els.progress.value}%` : `${els.progress.value}%（自動計算）`;
  }
});
// 對話框關閉時釋放鎖（儲存、取消、Esc 均觸發）
els.dialog.addEventListener("close", () => {
  releaseLock(state.editingId);
  state.editingId = null;
});

els.viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.viewMode = button.dataset.viewMode;
    persist();
    render();
  });
});
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  upsertTask();
});
els.copyTask.addEventListener("click", copyTaskBlock);
els.undoButton.addEventListener("click", undo);
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault();
    undo();
  }
});
els.deleteTask.addEventListener("click", () => {
  const deletedId = state.editingId;
  const idx = getTaskIndex(deletedId);
  if (idx < 0) return;

  const block = getTaskBlock(idx);
  const childCount = block.length - 1;
  const message = childCount > 0
    ? `確定要刪除「${block[0].name}」及其下 ${childCount} 個子項目？此操作無法復原。`
    : `確定要刪除「${block[0].name}」？`;

  showConfirm(message, () => {
    pushUndo();
    const blockIds = new Set(block.map((t) => t.id));
    state.tasks = state.tasks.filter((task) => !blockIds.has(task.id));
    state.tasks = state.tasks.map((task) => ({
      ...task,
      deps: (task.deps || []).filter((id) => !blockIds.has(id))
    }));
    persist();
    render();
    els.dialog.close();
  });
});
els.taskList.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".task-row");
  if (!row) return;

  const index = getTaskIndex(row.dataset.taskId);
  if (index < 0) return;

  state.drag = {
    id: row.dataset.taskId,
    startX: event.clientX,
    originalLevel: state.tasks[index].level
  };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.taskId);
  row.classList.add("dragging");
});
els.taskList.addEventListener("dragover", (event) => {
  if (!state.drag) return;
  event.preventDefault();
  const drop = getDropInfo(event);
  clearDropState();
  if (drop.row) {
    drop.row.classList.add(drop.position === "before" ? "drop-before" : "drop-after");
  }
});
els.taskList.addEventListener("drop", (event) => {
  if (!state.drag) return;
  event.preventDefault();

  const drop = getDropInfo(event);
  const wantedLevel = state.drag.originalLevel + Math.round((event.clientX - state.drag.startX) / 36);
  pushUndo();
  moveTaskBlock(state.drag.id, drop.index, wantedLevel);
  persist();
  state.suppressClick = true;
  state.drag = null;
  render();
  setTimeout(() => {
    state.suppressClick = false;
  }, 0);
});
els.taskList.addEventListener("dragend", () => {
  state.drag = null;
  clearDropState();
  els.taskList.querySelectorAll(".dragging").forEach((row) => row.classList.remove("dragging"));
});
document.addEventListener("click", (event) => {
  if (state.suppressClick) {
    event.preventDefault();
    return;
  }
  const toggle = event.target.closest("[data-toggle]");
  if (toggle && toggle.dataset.toggle) {
    event.preventDefault();
    event.stopPropagation();
    if (state.collapsed.has(toggle.dataset.toggle)) {
      state.collapsed.delete(toggle.dataset.toggle);
    } else {
      state.collapsed.add(toggle.dataset.toggle);
    }
    persist();
    render();
    return;
  }
  const target = event.target.closest("[data-edit]");
  if (!target) return;
  const task = state.tasks.find((item) => item.id === target.dataset.edit);
  if (task) openDialog(task);
});

async function initFromFirestore() {
  document.body.classList.add("db-loading");
  try {
    const snap = await getDoc(projectRef);
    if (snap.exists()) {
      const data = snap.data();
      state.tasks = (data.tasks || []).map(normalizeTask);
      state.projectName = data.projectName || "Project schedule";
      state.collapsed = new Set(data.collapsed || []);
    } else {
      state.tasks = seedTasks.map(t => ({ ...t }));
      persist();
    }
  } catch (err) {
    console.error("載入失敗:", err);
    state.tasks = seedTasks.map(t => ({ ...t }));
  }
  document.body.classList.remove("db-loading");
  updateProjectRegistry();
  render();

  onSnapshot(projectRef, (snap) => {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return;
    const data = snap.data();
    state.tasks = (data.tasks || []).map(normalizeTask);
    state.projectName = data.projectName || state.projectName;
    state.collapsed = new Set(data.collapsed || []);

    // 同步鎖定狀態，但保留自己正持有的鎖
    const remoteLocks = data.locks || {};
    const myEntry = state.editingId ? state.locks[state.editingId] : null;
    state.locks = remoteLocks;
    if (myEntry && state.editingId) state.locks[state.editingId] = myEntry;

    updateProjectRegistry();
    if (!els.dialog.open) {
      render();
    } else {
      // 對話框開著時仍更新任務列表鎖定狀態
      renderTasks();
    }
  });
}

initFromFirestore();
