/* ═══════════════════════════════════════════════════════════
   lang.js — 安燈系統 中文 / Tiếng Việt 雙語支援
   ═══════════════════════════════════════════════════════════ */

export const LANG = {
  zh: {
    /* ── 頁面標題 */
    pageTitle_dashboard : "安燈看板",
    pageTitle_line      : "安燈操作",
    pageTitle_admin     : "安燈管理設定",
    pageTitle_login     : "安燈系統 — 登入",
    pageTitle_vietnam   : "越南廠戰情看板",

    /* ── Header */
    dashTitle      : "安燈看板",
    vietnamTitle   : "越南廠戰情看板",
    vietnamSub     : "BẢNG CHỈ SỐ – NHÀ MÁY VIỆT NAM　資料來源：Google Sheets（即時同步）",

    /* ── 導覽按鈕 */
    btnMuteOn      : "🔔 蜂鳴器",
    btnMuteOff     : "🔇 靜音中",
    btnVietnam     : "🏭 戰情看板",
    btnAndon       : "🚨 安燈看板",
    btnAdmin       : "⚙ 管理設定",
    btnLogin       : "登入",
    btnLogout      : "登出",
    btnBack        : "← 回看板",

    /* ── 狀態 */
    statusOk       : "✓ 正常",
    statusAlert    : "⚡ 異常",
    statusNormalProd: "✓ 正常生產中",
    noModel        : "未設定機種",
    cardProduction : "生產機種",
    elapsed        : "已持續",
    abnormalLines  : "條異常",
    emptyBoard     : "尚未設定任何產線。",

    /* ── 異常類型 */
    typeQuality    : "⚠️ 品質異常",
    typeMaterial   : "📦 缺料",
    typeEquipment  : "🔧 設備故障",
    typeOther      : "❗ 其他異常",
    typeQualityS   : "品質異常",
    typeMaterialS  : "缺料",
    typeEquipmentS : "設備故障",
    typeOtherS     : "其他異常",

    /* ── 安燈操作頁 — 靜態 */
    lineInfoTitle  : "產線資訊",
    infoLineName   : "產線名稱",
    infoCategory   : "類別",
    infoModel      : "目前機種",
    triggerFormTitle: "啟動安燈",
    alertTypeLabel : "異常類型",
    alertDescLabel : "異常描述",
    alertDescPh    : "請簡述發生的問題…",
    requestUnitLabel: "希望處理單位",
    unitMax        : "（最多 3 個）",
    unit1Ph        : "單位 1（必填）",
    unit2Ph        : "單位 2（選填）",
    unit3Ph        : "單位 3（選填）",
    triggeredByLabel: "啟動人員姓名",
    triggeredByPh  : "請輸入您的姓名",
    btnTrigger     : "🚨 啟動安燈",
    btnTriggerIng  : "啟動中…",
    resolveFormTitle: "解除安燈",
    resolvedByLabel : "負責人姓名",
    resolvedByPh    : "請輸入您的姓名",
    countermeasureLabel: "解決對策",
    countermeasurePh: "請描述採取的對策或處理方式…",
    btnResolve     : "✅ 熄滅安燈",
    btnResolveIng  : "處理中…",
    btnCancel      : "取消",
    btnShowTrigger : "🚨 啟動安燈",
    btnShowResolve : "✅ 熄滅安燈",

    /* ── 安燈操作頁 — 異常詳情 */
    adDescLabel    : "描述",
    adUnitLabel    : "希望處理單位",
    adByLabel      : "啟動人員",
    adTimeLabel    : "啟動時間",
    adElapsedLabel : "已持續",

    /* ── 安燈操作頁 — 動態 banner */
    bannerAlert    : "異常中",

    /* ── 登入頁 */
    loginTitle     : "安燈系統",
    loginSub       : "請選擇角色並輸入 PIN 碼",
    operatorRole   : "🔔 操作員",
    adminRole      : "⚙ 管理員",
    pinLabel       : "PIN 碼",
    btnLoginBtn    : "登入",
    backToBoard    : "← 返回看板（無需登入）",
    verifying      : "驗證中…",
    wrongPin       : "PIN 碼錯誤，請重試",
    connFail       : "連線失敗：",
    enterPin       : "請輸入 PIN 碼",

    /* ── 管理頁 */
    adminTitle     : "安燈管理設定",
    tabLines       : "產線管理",
    tabBuildings   : "棟別設定",
    tabLogs        : "安燈紀錄",
    tabAuth        : "權限設定",
    roleOperator   : "🔔 操作員",
    roleAdmin      : "⚙ 管理員",
    openLinePage   : "開啟操作頁",

    /* ── 越南看板彈出 */
    popupTitle     : "⚡ 安燈警示",
    popupModel     : "機種：",
    popupUnknown   : "未設定",
    popupTriggered : "啟動：",
    popupClose     : "知道了，關閉",
    andonOk        : "正常",
    andonAbnormal  : "條產線異常",
  },

  vi: {
    /* ── 頁面標題 */
    pageTitle_dashboard : "Bảng Andon",
    pageTitle_line      : "Vận hành Andon",
    pageTitle_admin     : "Cài đặt Andon",
    pageTitle_login     : "Hệ thống Andon — Đăng nhập",
    pageTitle_vietnam   : "Bảng chỉ số nhà máy VN",

    /* ── Header */
    dashTitle      : "Bảng Andon",
    vietnamTitle   : "Bảng chỉ số nhà máy Việt Nam",
    vietnamSub     : "BẢNG CHỈ SỐ – NHÀ MÁY VIỆT NAM　Nguồn: Google Sheets (đồng bộ thời gian thực)",

    /* ── 導覽按鈕 */
    btnMuteOn      : "🔔 Còi báo",
    btnMuteOff     : "🔇 Đã tắt tiếng",
    btnVietnam     : "🏭 Bảng chỉ số",
    btnAndon       : "🚨 Bảng Andon",
    btnAdmin       : "⚙ Cài đặt",
    btnLogin       : "Đăng nhập",
    btnLogout      : "Đăng xuất",
    btnBack        : "← Về bảng",

    /* ── 狀態 */
    statusOk       : "✓ Bình thường",
    statusAlert    : "⚡ Sự cố",
    statusNormalProd: "✓ Đang sản xuất bình thường",
    noModel        : "Chưa cài đặt model",
    cardProduction : "Model SX",
    elapsed        : "Đã kéo dài",
    abnormalLines  : " dây chuyền sự cố",
    emptyBoard     : "Chưa cài đặt dây chuyền nào.",

    /* ── 異常類型 */
    typeQuality    : "⚠️ Sự cố chất lượng",
    typeMaterial   : "📦 Thiếu vật liệu",
    typeEquipment  : "🔧 Hỏng thiết bị",
    typeOther      : "❗ Sự cố khác",
    typeQualityS   : "Sự cố chất lượng",
    typeMaterialS  : "Thiếu vật liệu",
    typeEquipmentS : "Hỏng thiết bị",
    typeOtherS     : "Sự cố khác",

    /* ── 安燈操作頁 — 靜態 */
    lineInfoTitle  : "Thông tin dây chuyền",
    infoLineName   : "Tên dây chuyền",
    infoCategory   : "Loại",
    infoModel      : "Model hiện tại",
    triggerFormTitle: "Bật đèn cảnh báo",
    alertTypeLabel : "Loại sự cố",
    alertDescLabel : "Mô tả sự cố",
    alertDescPh    : "Mô tả ngắn gọn sự cố…",
    requestUnitLabel: "Bộ phận xử lý",
    unitMax        : "（tối đa 3 bộ phận）",
    unit1Ph        : "Bộ phận 1 (bắt buộc)",
    unit2Ph        : "Bộ phận 2 (tuỳ chọn)",
    unit3Ph        : "Bộ phận 3 (tuỳ chọn)",
    triggeredByLabel: "Tên người kích hoạt",
    triggeredByPh  : "Nhập tên của bạn",
    btnTrigger     : "🚨 Bật đèn cảnh báo",
    btnTriggerIng  : "Đang bật…",
    resolveFormTitle: "Tắt đèn cảnh báo",
    resolvedByLabel : "Tên người phụ trách",
    resolvedByPh    : "Nhập tên của bạn",
    countermeasureLabel: "Biện pháp xử lý",
    countermeasurePh: "Mô tả biện pháp đã thực hiện…",
    btnResolve     : "✅ Tắt đèn cảnh báo",
    btnResolveIng  : "Đang xử lý…",
    btnCancel      : "Hủy",
    btnShowTrigger : "🚨 Bật đèn cảnh báo",
    btnShowResolve : "✅ Tắt đèn cảnh báo",

    /* ── 安燈操作頁 — 異常詳情 */
    adDescLabel    : "Mô tả",
    adUnitLabel    : "Bộ phận xử lý",
    adByLabel      : "Người kích hoạt",
    adTimeLabel    : "Thời gian bắt đầu",
    adElapsedLabel : "Đã kéo dài",

    /* ── 安燈操作頁 — 動態 banner */
    bannerAlert    : "Đang có sự cố",

    /* ── 登入頁 */
    loginTitle     : "Hệ thống Andon",
    loginSub       : "Chọn vai trò và nhập mã PIN",
    operatorRole   : "🔔 Vận hành",
    adminRole      : "⚙ Quản trị",
    pinLabel       : "Mã PIN",
    btnLoginBtn    : "Đăng nhập",
    backToBoard    : "← Về bảng hiển thị (không cần đăng nhập)",
    verifying      : "Đang xác minh…",
    wrongPin       : "Mã PIN không đúng, vui lòng thử lại",
    connFail       : "Lỗi kết nối: ",
    enterPin       : "Vui lòng nhập mã PIN",

    /* ── 管理頁 */
    adminTitle     : "Cài đặt hệ thống Andon",
    tabLines       : "Quản lý dây chuyền",
    tabBuildings   : "Cài đặt tòa nhà",
    tabLogs        : "Lịch sử cảnh báo",
    tabAuth        : "Cài đặt quyền",
    roleOperator   : "🔔 Vận hành",
    roleAdmin      : "⚙ Quản trị",
    openLinePage   : "Mở trang vận hành",

    /* ── 越南看板彈出 */
    popupTitle     : "⚡ Cảnh báo Andon",
    popupModel     : "Model: ",
    popupUnknown   : "Chưa cài đặt",
    popupTriggered : "Người kích hoạt: ",
    popupClose     : "Đã hiểu, đóng",
    andonOk        : "Bình thường",
    andonAbnormal  : " dây chuyền sự cố",
  }
};

/* ── 取得目前語言 */
export function getLang() {
  return localStorage.getItem("andon_lang") || "zh";
}

/* ── 取得翻譯字串 */
export function t(key) {
  const lang = getLang();
  return LANG[lang]?.[key] ?? LANG.zh?.[key] ?? key;
}

/* ── 套用語言到靜態 DOM */
export function applyLang(lang) {
  localStorage.setItem("andon_lang", lang);

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const val = LANG[lang]?.[el.dataset.i18n];
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const val = LANG[lang]?.[el.dataset.i18nPh];
    if (val !== undefined) el.placeholder = val;
  });

  // 更新切換按鈕文字
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.textContent = lang === "zh" ? "VI" : "ZH";
    btn.setAttribute("title", lang === "zh" ? "Chuyển sang Tiếng Việt" : "切換為中文");
  });

  // 更新頁面標題
  const pk = document.documentElement.dataset.pageKey;
  if (pk && LANG[lang]?.["pageTitle_" + pk]) {
    document.title = LANG[lang]["pageTitle_" + pk];
  }
}

/* ── 初始化（頁面載入時呼叫） */
export function initLang(onChangeCb) {
  const lang = getLang();
  applyLang(lang);

  // 綁定所有 .lang-btn 點擊
  document.addEventListener("click", e => {
    if (!e.target.classList.contains("lang-btn")) return;
    const newLang = getLang() === "zh" ? "vi" : "zh";
    applyLang(newLang);
    if (onChangeCb) onChangeCb(newLang);
  });

  return lang;
}
