// auth-guard.js — 共用登入驗證與權限模組
// 由各系統頁面以 <script type="module" src="auth-guard.js?v=N"></script> 引入。
// 修改這個檔案時記得把 ?v= 版本號往上加一，否則 Firebase Hosting／瀏覽器
// 的快取會讓其他頁面繼續抓到舊版本（styles.css 也是用同樣的機制）。
// 未登入者導向 login.html（帶 redirect 參數，登入後導回原頁）；
// 已登入者在頁面頂端顯示「工號/姓名 + 登出」，並將權限資料掛在 window.mivUser。
//
// ── 權限模型（v3 起）────────────────────────────────────────
// users/{uid} 文件欄位：
//   employeeId, name            工號與姓名
//   role: "admin" | ""          系統管理員旗標（admin 等於所有系統都有管理權）
//   useApps:    ["andon", …]    可「使用」的系統代碼清單
//   manageApps: ["toolroom", …] 可「管理」的系統代碼清單（有管理必然有使用）
//
// 舊資料（只有 role: viewer/production/toolroom/quality）在還沒被
// admin-users.html 轉存成新格式之前，會用下面的 LEGACY_* 對照表推導出
// 等效權限，因此升級當下不會有人突然失去權限；一旦該帳號存過新格式
// （文件出現 useApps/manageApps），就完全以勾選結果為準。

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-shXfvnOP-QqJsSu_QDmiO096fPQoxfs",
  authDomain: "miv-1426c.firebaseapp.com",
  projectId: "miv-1426c",
  storageBucket: "miv-1426c.firebasestorage.app",
  messagingSenderId: "398934341623",
  appId: "1:398934341623:web:4af46c057d2e202855a0f2"
};

const LOGIN_PAGE = "login.html";
const HUB_PAGE = "index.html";

// ── 系統清單 ────────────────────────────────────────────────
// admin-users.html 的勾選矩陣、index.html 的磁磚顯示、各系統頁面的權限
// 判斷都以這份清單為準。要新增系統只需在這裡加一列，並在 firestore.rules
// 對應的 match 區塊呼叫 canUse()/canManage()。
export const MIV_APPS = [
  { key: "andon", name: "安燈系統", sub: "Andon", short: "安燈",
    useHint: "產線觸發／解除異常", manageHint: "後台設定（產線、PIN、棟別）" },
  { key: "toolroom", name: "工具室系統", sub: "Toolroom", short: "工具室",
    useHint: "查詢庫存、提出領用申請", manageHint: "品項維護、入出庫、領用審核" },
  { key: "issue", name: "問題反映系統", sub: "Issue Report", short: "問題反映",
    useHint: "首頁入口（回報頁本身免登入）", manageHint: "" },
  { key: "calibration", name: "校驗管理", sub: "Calibration", short: "校驗",
    useHint: "查詢、匯出、新增校驗紀錄", manageHint: "設備新增／編輯／刪除／匯入" },
  { key: "inspection", name: "製程巡檢系統", sub: "Process Inspection", short: "巡檢",
    useHint: "紀錄查詢、異常追蹤", manageHint: "巡檢作業、異常簽核、後台" },
  { key: "container", name: "裝櫃計算工具", sub: "Container Loading", short: "裝櫃",
    useHint: "試算與機種查詢", manageHint: "機種主檔維護" },
  { key: "techreq", name: "技術課委託管理", sub: "Tech Request", short: "技術委託",
    useHint: "送單、檢視、簽核", manageHint: "後台單位／類別／工時單價" },
  { key: "purchase", name: "採購進度追蹤", sub: "Purchase Tracking", short: "採購",
    useHint: "檢視案件與報表", manageHint: "建立／編輯案件、後台主檔" },
];
export const MIV_APP_KEYS = MIV_APPS.map(a => a.key);

// ── 舊角色對照（僅供尚未轉存成新格式的帳號使用）──────────────
const LEGACY_USE = {
  andon:       ["viewer", "production", "toolroom", "quality", "admin"],
  toolroom:    ["viewer", "production", "toolroom", "quality", "admin"],
  issue:       ["viewer", "production", "toolroom", "quality", "admin"],
  calibration: ["viewer", "production", "quality", "admin"],
  inspection:  ["viewer", "production", "quality", "admin"],
  container:   ["viewer", "production", "toolroom", "quality", "admin"],
  techreq:     ["viewer", "production", "toolroom", "quality", "admin"],
  purchase:    ["viewer", "production", "toolroom", "quality", "admin"],
};
const LEGACY_MANAGE = {
  andon:       ["admin"],
  toolroom:    ["toolroom", "admin"],
  issue:       ["admin"],
  calibration: ["quality", "admin"],
  inspection:  ["quality", "admin"],
  container:   ["admin"],
  techreq:     ["admin"],
  purchase:    ["production", "toolroom", "quality", "admin"],
};

// 由 users 文件資料算出實際權限：{ isAdmin, use:Set, manage:Set, migrated }
// admin-users.html 也用這支函式把舊角色換算成預設勾選狀態。
export function mivResolvePerms(data) {
  const d = data || {};
  const role = d.role || "";
  const isAdmin = role === "admin";
  const migrated = Array.isArray(d.useApps) || Array.isArray(d.manageApps);
  const rawUse = Array.isArray(d.useApps) ? d.useApps : [];
  const rawManage = Array.isArray(d.manageApps) ? d.manageApps : [];
  const use = new Set(), manage = new Set();

  MIV_APP_KEYS.forEach(key => {
    let canM, canU;
    if (isAdmin) {
      canM = true; canU = true;
    } else if (migrated) {
      canM = rawManage.includes(key);
      canU = canM || rawUse.includes(key);
    } else {
      canM = (LEGACY_MANAGE[key] || []).includes(role);
      canU = canM || (LEGACY_USE[key] || []).includes(role);
    }
    if (canU) use.add(key);
    if (canM) manage.add(key);
  });
  return { isAdmin, use, manage, migrated };
}

const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function goToLogin() {
  const redirect = encodeURIComponent(location.pathname + location.search);
  location.replace(`${LOGIN_PAGE}?redirect=${redirect}`);
}

export function mivLogout() {
  signOut(auth).finally(() => { location.href = LOGIN_PAGE; });
}
window.mivLogout = mivLogout;

function isHubPage() {
  const path = location.pathname.replace(/\/+$/, "");
  return path === "" || path.endsWith("/" + HUB_PAGE) || path === "/" + HUB_PAGE;
}

// 權限不足時的統一畫面。level 為 "use"（不可進入）或 "manage"（不可管理）。
export function mivDenyScreen(appKey, level = "use", backHref) {
  const app = MIV_APPS.find(a => a.key === appKey);
  const appName = app ? app.name : appKey;
  const what = level === "manage" ? `「${appName}」的管理權限` : `「${appName}」的使用權限`;
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:10px;color:#374151;text-align:center;padding:24px;font:14px/1.6 'Segoe UI','Noto Sans TC',Arial,sans-serif">
      <p style="font-size:1.2rem;font-weight:700">權限不足</p>
      <p style="color:#64748b">您的帳號沒有${esc(what)}，請聯絡系統管理員於「使用者權限管理」勾選。<br>
        <span style="font-style:italic;font-size:.9em">Tài khoản của bạn chưa được cấp quyền, vui lòng liên hệ quản trị viên.</span></p>
      <a href="${esc(backHref || HUB_PAGE)}" style="color:#2563eb">← 返回首頁 / Trang chủ</a>
      <button onclick="window.mivLogout()" style="margin-top:6px;padding:6px 16px;border:1px solid #cbd5e1;background:transparent;border-radius:8px;color:#64748b;cursor:pointer">登出 / Đăng xuất</button>
    </div>`;
}

// 頁面守門：await mivRequireApp("toolroom") 或 mivRequireApp("andon", "manage")。
// 權限足夠時回傳使用者資料；不足時顯示權限不足畫面並 throw，中止後續程式。
export async function mivRequireApp(appKey, level = "use", backHref) {
  const user = await mivAuthReady;
  const ok = level === "manage" ? user.canManage(appKey) : user.can(appKey);
  if (!ok) {
    mivDenyScreen(appKey, level, backHref);
    throw new Error(`insufficient permission: ${appKey}/${level}`);
  }
  return user;
}

function renderAuthBar(user) {
  if (document.getElementById("miv-auth-bar")) return;
  const bar = document.createElement("div");
  bar.id = "miv-auth-bar";
  bar.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 16px;background:#1f2937;color:#e5e7eb;font:13px/1.4 'Segoe UI','Noto Sans TC',Arial,sans-serif;position:relative;z-index:10000";
  const roleText = user.isAdmin ? "管理員" : "";
  const homeLink = isHubPage() ? "<span></span>" :
    `<a href="${HUB_PAGE}" style="color:#e5e7eb;opacity:.85;text-decoration:none;font-size:12px;display:flex;align-items:center;gap:5px">🏠 返回首頁</a>`;
  bar.innerHTML = `
    ${homeLink}
    <span style="display:flex;align-items:center;gap:12px">
      <span style="opacity:.9">${esc(user.name || user.employeeId)}${user.name ? ` <span style="opacity:.6">(${esc(user.employeeId)})</span>` : ""}${roleText ? ` <span style="opacity:.5">｜${esc(roleText)}</span>` : ""}</span>
      <button id="miv-logout-btn" type="button" style="border:1px solid rgba(255,255,255,.3);background:transparent;color:#e5e7eb;border-radius:6px;padding:3px 12px;font-size:12px;cursor:pointer">登出</button>
    </span>
  `;
  document.body.insertBefore(bar, document.body.firstChild);
  document.getElementById("miv-logout-btn").addEventListener("click", mivLogout);
}

let resolveReady;
// 供頁面自行 import 使用：
//   const user = await mivAuthReady;
//   user.can("toolroom")        → 是否可使用工具室系統
//   user.canManage("toolroom")  → 是否可管理工具室系統
//   user.isAdmin                → 是否為系統管理員
export const mivAuthReady = new Promise(resolve => { resolveReady = resolve; });

setPersistence(auth, browserLocalPersistence).catch(() => {});

onAuthStateChanged(auth, async (user) => {
  if (!user) { goToLogin(); return; }

  const profile = { uid: user.uid, employeeId: (user.email || "").split("@")[0], name: "", role: "" };
  let data = null;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      data = snap.data();
      profile.employeeId = data.employeeId || profile.employeeId;
      profile.name = data.name || "";
      profile.role = data.role || "";
    }
  } catch (err) {
    console.error("讀取使用者權限失敗：", err);
  }

  const perms = mivResolvePerms(data);
  profile.isAdmin = perms.isAdmin;
  profile.useApps = [...perms.use];
  profile.manageApps = [...perms.manage];
  profile.can = key => perms.use.has(key);
  profile.canManage = key => perms.manage.has(key);
  // 完全沒有任何系統可用（首頁用來顯示「尚未指派權限」提示）
  profile.hasNoAccess = perms.use.size === 0;

  window.mivUser = profile;
  renderAuthBar(profile);
  document.dispatchEvent(new CustomEvent("miv-auth-ready", { detail: profile }));
  resolveReady(profile);
});
