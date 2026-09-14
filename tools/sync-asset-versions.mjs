#!/usr/bin/env node
// tools/sync-asset-versions.mjs
//
// 把全站引用的 ?v= 版本號改成「由檔案內容算出的雜湊」，讓快取自動失效。
//
// 為什麼要這支腳本：
//   auth-guard.js / styles.css / purchase-flow.js 這類共用檔案在 Firebase
//   Hosting 上是 max-age=3600（HTML 才是 no-cache），所以改完內容如果忘了把
//   引用網址的 ?v= 往上加，使用者最多一小時內還是拿到舊版。
//   實際發生過兩次：
//     - auth-guard.js 一度同時存在 ?v=3 與 ?v=4 兩種引用
//     - purchase-flow.js 內容改了（B 流程調整）但版本號沒動
//   手動維護號碼遲早會漏，改成內容雜湊就不會有這個問題：
//   檔案沒變 → 版本號不變（快取繼續生效）；檔案一變 → 版本號自動變。
//
// 用法：
//   node tools/sync-asset-versions.mjs           把所有引用改成正確的雜湊
//   node tools/sync-asset-versions.mjs --check   只檢查，有落差就 exit 1（不改檔）
//
// 已接在 firebase.json 的 hosting.predeploy，所以 firebase deploy 會自動跑。

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");

// 不掃描的路徑：本機測試檔、工具、相依套件、隱藏資料夾
const SKIP_DIRS = new Set(["node_modules", "tools", ".git", ".firebase", ".claude", ".github", ".agents"]);
const skipFile = name => name.startsWith("_preview-") || name.startsWith(".");

// 會被掃描與改寫的檔案類型
const SCAN_EXT = /\.(html|js)$/i;

// 比對 "some/path/asset.js?v=xxx"，分成 前綴路徑 / 檔名 / 版本 三段
const REF = /([A-Za-z0-9_\-./]*?)([A-Za-z0-9_\-.]+\.(?:js|css))\?v=([A-Za-z0-9]+)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skipFile(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (SCAN_EXT.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const shortHash = file =>
  createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);

const files = walk(ROOT);
const missing = new Set();  // 被引用但找不到的檔案

// 跑一輪：重新計算所有雜湊並改寫引用，回傳這一輪的異動
function pass(write) {
  const hashes = new Map();          // 檔名 -> 雜湊（每輪重算）
  const changes = [];                // { file, base, from, to }
  const touched = new Set();

  const hashFor = base => {
    if (hashes.has(base)) return hashes.get(base);
    const path = join(ROOT, base);
    // 目前所有版本化資產都在專案根目錄；找不到就不動那個引用
    const h = existsSync(path) ? shortHash(path) : null;
    if (!h) missing.add(base);
    hashes.set(base, h);
    return h;
  };

  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const after = before.replace(REF, (match, dir, base, ver) => {
      // auth-guard.js 註解裡的 "auth-guard.js?v=N" 是說明文字，不是真的引用
      if (ver === "N") return match;
      const h = hashFor(base);
      if (!h || h === ver) return match;
      changes.push({ file: file.slice(ROOT.length + 1), base, from: ver, to: h });
      return `${dir}${base}?v=${h}`;
    });
    if (after !== before) {
      touched.add(file);
      if (write) writeFileSync(file, after);
    }
  }
  return { hashes, changes, touched };
}

// 若某個資產檔本身也引用了別的資產（例如某個 .js import 另一個 .js?v=），
// 改寫它就會改變它自己的內容、連帶改變它的雜湊，使剛寫出去的版本號馬上過時。
// 因此重複跑到不再有異動為止，確保收斂。
const allChanges = [];
let result, rounds = 0;
do {
  result = pass(!CHECK_ONLY);
  allChanges.push(...result.changes);
  rounds++;
} while (!CHECK_ONLY && result.changes.length && rounds < 5);

if (!CHECK_ONLY && result.changes.length) {
  console.error("✗ 版本號在 5 輪內沒有收斂，可能有循環引用，請檢查。");
  process.exit(1);
}

const changes = allChanges;
const changedFiles = new Set(allChanges.map(c => c.file)).size;
const finalHashes = CHECK_ONLY ? result.hashes : pass(false).hashes;

// ── 輸出 ────────────────────────────────────────────────────
const assets = [...finalHashes.entries()].filter(([, h]) => h);
console.log(`掃描 ${files.length} 個檔案，找到 ${assets.length} 個版本化資產：`);
for (const [base, h] of assets) {
  const n = changes.filter(c => c.base === base).length;
  console.log(`  ${base.padEnd(20)} ?v=${h}${n ? `  （更新 ${n} 處引用）` : "  （已是最新）"}`);
}
if (missing.size) {
  console.log(`\n⚠ 被引用但找不到檔案，已略過：${[...missing].join(", ")}`);
}

if (!changes.length) {
  console.log("\n✓ 全站 ?v= 版本號都與檔案內容一致。");
  process.exit(0);
}

// 同一個資產若原本有多種版本號並存，特別點出來（就是會出事的那種狀況）
for (const [base] of assets) {
  const vers = [...new Set(changes.filter(c => c.base === base).map(c => c.from))];
  if (vers.length > 1) {
    console.log(`\n⚠ ${base} 原本同時存在 ${vers.length} 種版本號（${vers.map(v => "?v=" + v).join("、")}），已一併對齊。`);
  }
}

if (CHECK_ONLY) {
  console.log(`\n✗ 有 ${changes.length} 處引用與檔案內容不符（分布在 ${changedFiles} 個檔案）。`);
  console.log("  執行 node tools/sync-asset-versions.mjs 修正。");
  process.exit(1);
}

console.log(`\n✓ 已更新 ${changes.length} 處引用，涉及 ${changedFiles} 個檔案。`);
