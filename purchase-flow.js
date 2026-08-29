// purchase-flow.js — 採購流程定義（A 一般合約 / B 訂貨契約單）
// 來源：品保設備採購進度追蹤_最終版.xlsx →「流程步驟說明」工作表 v3
// 修改本檔後請把引用頁面的 ?v= 版本號往上加，避免瀏覽器快取到舊版。

// 金額判斷門檻（台幣）：預付款 < 30萬 且 總價 < 100萬 → B 流程，否則 → A 流程
export const THRESHOLD = { prepayTWD: 300000, totalTWD: 1000000 };

// 匯率僅用於「建議走 A 或 B」的粗略換算，不用於任何金額統計。
// 實際匯率變動時由管理員在 purchase-admin.html 調整（存 purchase_meta/config.fxToTWD）。
export const DEFAULT_FX_TO_TWD = { TWD: 1, USD: 32, VND: 0.00125 };

const S = (key, zh, vi, owner, ownerVi, desc, descVi, days, star) =>
  ({ key, zh, vi, owner, ownerVi, desc, descVi, days, star: !!star });

// 共用步驟（A/B 皆走）
export const COMMON_STEPS = [
  S("1", "請購單提出與簽核", "Đề xuất & ký duyệt phiếu YCMH",
    "請購單位 / 各級主管", "Bộ phận yêu cầu / Các cấp quản lý",
    "填寫請購單並附上請購清單與效益分析；由各級主管逐級簽核，取得請購許可",
    "Điền phiếu yêu cầu kèm danh sách & phân tích lợi ích; các cấp quản lý ký duyệt",
    [2, 5]),
  S("2", "詢價、比價、議價", "Hỏi giá, so sánh, đàm phán",
    "採購單位", "Bộ phận mua hàng",
    "負責詢價、比價、議價，確認採購條件後提出正式報價單",
    "Hỏi giá, so sánh giá, đàm phán; sau khi xác nhận điều kiện, lập báo giá chính thức",
    [3, 7]),
];

// A 一般合約流程（總價 ≥ 100萬 或 預付款 ≥ 30萬）
export const PATH_A_STEPS = [
  S("A3", "【新供應商】索取匯款資料", "【NCC mới】Yêu cầu thông tin chuyển khoản",
    "採購單位", "Bộ phận mua hàng",
    "條件步驟：詢價後向新供應商索取銀行匯款基本資料（舊供應商可跳過）",
    "Bước có điều kiện: yêu cầu NCC mới cung cấp thông tin TK ngân hàng (NCC cũ bỏ qua)",
    [1, 3], true),
  S("A4", "【條件】付款條件變更通知", "【Điều kiện】Thông báo thay đổi ĐK thanh toán",
    "採購單位 / 財務", "Bộ phận mua hàng / Tài chính",
    "條件步驟：若供應商不同意付款條件，須取得對方財務負責主管郵件確認",
    "Bước có điều kiện: nếu NCC không đồng ý ĐK TT, phải lấy xác nhận email từ trưởng tài chính bên họ",
    [3, 5], true),
  S("A5", "填寫審約需求單並寄給法務", "Điền phiếu yêu cầu thẩm định & gửi pháp lý",
    "請購單位主管 / 副總", "Trưởng bộ phận YC / Phó TGĐ",
    "填寫審約需求單（主管→副總）送簽；整理合約重點（金額、交期、驗收、付款）寄法務",
    "Điền phiếu yêu cầu thẩm định (Trưởng BP→Phó TGĐ); tóm tắt nội dung HĐ gửi pháp lý",
    [2, 3]),
  S("A6", "法務擬約暨與廠商溝通確認", "Pháp lý soạn HĐ & trao đổi với NCC",
    "法務 / 採購單位", "Pháp lý / Bộ phận mua hàng",
    "法務擬定合約草稿；期間與廠商溝通內容，盡量在正式簽核前達成共識",
    "Pháp lý soạn thảo hợp đồng; trao đổi với NCC, đạt đồng thuận trước khi ký chính thức",
    [7, 14]),
  S("A7", "正審表（正式審約）", "Bảng thẩm định chính thức",
    "法務 / 相關單位", "Pháp lý / Đơn vị liên quan",
    "法務提出正審表，由相關單位（法務、財務、業務等）逐一審核簽核",
    "Pháp lý lập bảng thẩm định, các đơn vị liên quan lần lượt xem xét & ký",
    [3, 7]),
  S("A8", "用印申請表", "Phiếu yêu cầu đóng dấu",
    "採購單位 / 越南財務", "Bộ phận mua hàng / Tài chính VN",
    "正審表簽核後，寄越南財務建立合約編號（CON-XXX）；相關單位審核用印申請",
    "Sau khi bảng thẩm định được ký, gửi tài chính VN tạo số hợp đồng (CON-XXX)",
    [2, 5]),
  S("A9", "雙方蓋大小章（力山＋廠商）", "Hai bên đóng dấu (Rexon + NCC)",
    "力山總務 / 廠商", "Hành chính Rexon / Nhà cung cấp",
    "確認雙方用印完成，合約正式生效",
    "Xác nhận cả hai bên đã đóng dấu xong, hợp đồng chính thức có hiệu lực",
    [1, 3]),
  S("A10", "合約生效 → 付款 / 交貨", "HĐ có hiệu lực → Thanh toán / Giao hàng",
    "採購單位 / 財務", "Bộ phận mua hàng / Tài chính",
    "追蹤交貨與驗收；安排請款與付款作業",
    "Theo dõi giao hàng & nghiệm thu; thu xếp lập hóa đơn và thanh toán",
    null),
  S("A11", "付款憑證單", "Phiếu chứng từ thanh toán",
    "請購單位 / 總經理", "Bộ phận yêu cầu / Tổng giám đốc",
    "由請購單位印出付款憑證單，交由總經理簽核後執行付款",
    "Bộ phận yêu cầu in phiếu chứng từ TT, trình Tổng GĐ ký duyệt rồi thanh toán",
    null),
];

// B 訂貨契約單流程（預付款 < 30萬 且 總價 < 100萬）
export const PATH_B_STEPS = [
  S("B1", "填寫申請文件 → 部門主管", "Điền hồ sơ đăng ký → Trưởng bộ phận",
    "請購單位 / 部門主管", "Bộ phận yêu cầu / Trưởng bộ phận",
    "填寫訂貨契約單與用印申請單，完成部門主管簽核",
    "Điền phiếu đặt hàng và phiếu yêu cầu đóng dấu, hoàn tất ký duyệt của trưởng BP",
    [1, 2]),
  S("B2", "郵件提供財務部資料", "Gửi email tài liệu cho tài chính",
    "採購單位", "Bộ phận mua hàng",
    "以郵件將已簽核之用印申請單與訂貨契約單提供給財務部",
    "Gửi email phiếu yêu cầu đóng dấu đã ký và phiếu đặt hàng cho tài chính",
    [1, 1]),
  S("B3", "取得訂貨契約單編號（PO-XXX）", "Lấy số phiếu đặt hàng (PO-XXX)",
    "財務部 / 採購單位", "Bộ phận tài chính / Mua hàng",
    "財務部確認基本資料後，填寫訂貨契約單編號（PO-XXX）",
    "Sau khi tài chính xác nhận thông tin, điền số phiếu đặt hàng (PO-XXX)",
    [1, 2]),
  S("B4", "送件辦理用印 → 財務部", "Nộp hồ sơ đóng dấu → Tài chính",
    "採購單位 / 財務部", "Bộ phận mua hàng / Tài chính",
    "依部門需求列印份數；送件用印申請單與訂貨契約單至財務部辦理用印",
    "In số bản theo nhu cầu; nộp phiếu yêu cầu đóng dấu và phiếu đặt hàng đến tài chính",
    [1, 2]),
];

/** 取得指定路徑的完整步驟清單（共用 2 步 + 分支步驟） */
export function stepsOf(path) {
  return COMMON_STEPS.concat(path === "B" ? PATH_B_STEPS : PATH_A_STEPS);
}

/** 全部步驟索引：key → 步驟定義（含 A/B 兩條路徑，供匯入與統計使用） */
export const STEP_BY_KEY = Object.fromEntries(
  COMMON_STEPS.concat(PATH_A_STEPS, PATH_B_STEPS).map(s => [s.key, s])
);

/** 依金額建議走 A 或 B 流程。無法判斷（缺金額）時回傳 null。 */
export function suggestPath(amount, currency, prepayRatio, fx) {
  const rate = (fx || DEFAULT_FX_TO_TWD)[currency];
  if (!rate || !(amount > 0)) return null;
  const totalTWD = amount * rate;
  const prepayTWD = totalTWD * (prepayRatio > 0 ? prepayRatio : 1);
  return (prepayTWD < THRESHOLD.prepayTWD && totalTWD < THRESHOLD.totalTWD) ? "B" : "A";
}

/**
 * 計算案件目前進度。
 * steps 形如 { "1": {state:"done"|"doing"|"skip"|"todo", date, by, note}, ... }
 * 回傳 { list, current, doneCount, totalCount, percent, finished }
 */
export function progressOf(caseData) {
  const list = stepsOf(caseData.path).map(def => {
    const rec = (caseData.steps || {})[def.key] || {};
    return { ...def, state: rec.state || "todo", date: rec.date || "", by: rec.by || "", note: rec.note || "" };
  });
  // 目前步驟＝第一個尚未完成／未跳過的步驟；若全部走完則為 null
  const current = list.find(s => s.state !== "done" && s.state !== "skip") || null;
  const counted = list.filter(s => s.state !== "skip");
  const doneCount = counted.filter(s => s.state === "done").length;
  const totalCount = counted.length || 1;
  return {
    list, current, doneCount, totalCount,
    percent: Math.round(doneCount / totalCount * 100),
    finished: !current,
  };
}

/** 餘裕天數 = 必要日期 − 預計完成日（沿用原 Excel 公式 S−T） */
export function slackDays(requiredDate, etaDate) {
  if (!requiredDate || !etaDate) return null;
  const a = new Date(requiredDate + "T00:00:00"), b = new Date(etaDate + "T00:00:00");
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

/** 風險等級（門檻沿用原 Excel：<0 逾期／<7 高／<14 中／否則低） */
export const RISK = {
  overdue: { key: "overdue", zh: "已逾期", vi: "Đã quá hạn", icon: "🔴", cls: "risk-overdue" },
  high:    { key: "high",    zh: "高風險", vi: "Rủi ro cao", icon: "🟠", cls: "risk-high" },
  mid:     { key: "mid",     zh: "中風險", vi: "Rủi ro TB",  icon: "🟡", cls: "risk-mid" },
  low:     { key: "low",     zh: "低風險", vi: "Rủi ro thấp", icon: "🟢", cls: "risk-low" },
  none:    { key: "none",    zh: "未評估", vi: "Chưa đánh giá", icon: "⚪", cls: "risk-none" },
};

export function riskOf(slack) {
  if (slack === null || slack === undefined) return RISK.none;
  if (slack < 0) return RISK.overdue;
  if (slack < 7) return RISK.high;
  if (slack < 14) return RISK.mid;
  return RISK.low;
}

// ── 付款條件 ─────────────────────────────────────────────────
// 條件由「類型 + 天數」兩段組成，類型清單存在 purchase_meta/config.payTerms，
// 由管理員在 purchase-admin.html 維護；這裡只提供出廠預設值。
export const DEFAULT_PAY_TERMS = [
  { code: "TT",   label: "TT 電匯",  labelVi: "TT chuyển khoản",    days: true,  monthEnd: false },
  { code: "月結", label: "月結",     labelVi: "Kết toán cuối tháng", days: true,  monthEnd: true },
  { code: "預付", label: "預付",     labelVi: "Trả trước",           days: false, monthEnd: false },
  { code: "現金", label: "現金",     labelVi: "Tiền mặt",            days: false, monthEnd: false },
];

// 舊資料只有一個字串欄位（TT30、TT14、月结30天…），拆回類型與天數
export function parseTerm(term, terms = DEFAULT_PAY_TERMS) {
  const t = String(term || "").trim();
  if (!t) return { type: "", days: null };
  for (const def of terms) {
    // 月結有簡繁兩種寫法，一併比對
    const codes = def.code === "月結" ? ["月結", "月结"] : [def.code];
    for (const c of codes) {
      if (t.toUpperCase().startsWith(c.toUpperCase())) {
        const m = /(\d{1,3})/.exec(t.slice(c.length));
        return { type: def.code, days: m ? Number(m[1]) : null };
      }
    }
  }
  // 不在主檔裡的寫法原樣保留，避免匯入資料被吃掉
  const m = /^([A-Za-z\u4e00-\u9fff]+)\s*(\d{1,3})?/.exec(t);
  return { type: m ? m[1] : t, days: m && m[2] ? Number(m[2]) : null, unknown: true };
}

export function formatTerm(type, days) {
  if (!type) return "";
  if (days === null || days === undefined || days === "") return type;
  return type.startsWith("月") ? `${type}${days}天` : `${type}${days}`;
}

/**
 * 依付款條件從基準日推算應付日。
 * 月結類型先推到當月最後一天再加天數（月結 30 天＝當月結帳後 30 天），其餘直接加天數。
 */
export function dueFromTerm(baseISO, type, days, terms = DEFAULT_PAY_TERMS) {
  if (!baseISO || days === null || days === undefined || days === "") return "";
  const d = new Date(baseISO + "T00:00:00");
  if (isNaN(d)) return "";
  const def = terms.find(t => t.code === type);
  const monthEnd = def ? !!def.monthEnd : String(type).startsWith("月");
  if (monthEnd) d.setMonth(d.getMonth() + 1, 0);   // 推到當月最後一天
  d.setDate(d.getDate() + Number(days));
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
