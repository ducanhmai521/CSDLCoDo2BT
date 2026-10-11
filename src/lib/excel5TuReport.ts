import * as XLSX from "xlsx-js-style";
import { format } from "date-fns";

export interface Criterion5Tu {
  stt: number;
  category: "I" | "II" | "III" | "IV" | "V";
  categoryTitle: string;
  name: string;
  points: number;
  keywords: string[];
}

export const CRITERIA_5_TU: Criterion5Tu[] = [
  // I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)
  {
    stt: 1,
    category: "I",
    categoryTitle: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)",
    name: "Đi học muộn có phép (báo GVCN trước 7h15, GVCN báo ĐTN trước 9h15)",
    points: 3,
    keywords: ["muộn có phép", "đi học muộn có phép"],
  },
  {
    stt: 2,
    category: "I",
    categoryTitle: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)",
    name: "Đi học muộn không phép",
    points: 5,
    keywords: ["muộn không phép", "đi học muộn không phép", "đi muộn", "học muộn"],
  },
  {
    stt: 3,
    category: "I",
    categoryTitle: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)",
    name: "Thiếu đồ dùng học tập / thiếu ghế chào cờ",
    points: 3,
    keywords: ["thiếu đồ dùng", "thiếu ghế", "đồ dùng học tập", "ghế chào cờ"],
  },
  {
    stt: 4,
    category: "I",
    categoryTitle: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)",
    name: "Truy bài lộn xộn (đùa nghịch, làm việc riêng, ăn quà, gây ồn, trống truy bài chưa vào lớp)",
    points: 5,
    keywords: ["truy bài", "truy bài lộn xộn", "trống truy bài"],
  },
  {
    stt: 5,
    category: "I",
    categoryTitle: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)",
    name: "Nộp danh sách, văn bản, giấy tờ, quỹ... không đúng quy định",
    points: 20,
    keywords: ["nộp danh sách", "văn bản", "giấy tờ", "quỹ", "không đúng quy định"],
  },
  {
    stt: 6,
    category: "I",
    categoryTitle: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)",
    name: "Không thực hiện đúng yêu cầu phát động cuộc thi / kế hoạch của Đoàn trường",
    points: 20,
    keywords: ["phát động cuộc thi", "kế hoạch của đoàn", "kế hoạch đoàn", "cuộc thi đoàn"],
  },

  // II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)
  {
    stt: 7,
    category: "II",
    categoryTitle: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)",
    name: "Thực hiện đồng phục không đúng quy định (quần áo, giày dép, mác áo...)",
    points: 3,
    keywords: ["đồng phục", "quần áo", "giày dép", "mác áo", "mặc sai"],
  },
  {
    stt: 8,
    category: "II",
    categoryTitle: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)",
    name: "Vi phạm quy định đầu tóc, móng tay, xăm trổ, đeo khuyên tai/khuyên mặt",
    points: 3,
    keywords: ["đầu tóc", "móng tay", "xăm trổ", "xăm", "khuyên tai", "khuyên mặt", "nhuộm tóc"],
  },
  {
    stt: 9,
    category: "II",
    categoryTitle: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)",
    name: "Chào cờ, TD giữa giờ, ngoại khóa xuống xếp hàng muộn, lộn xộn phải nhắc nhở",
    points: 5,
    keywords: ["chào cờ", "td giữa giờ", "thể dục", "ngoại khóa", "xếp hàng muộn", "lộn xộn"],
  },
  {
    stt: 10,
    category: "II",
    categoryTitle: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)",
    name: "Học sinh nói tục, chửi thề",
    points: 10,
    keywords: ["nói tục", "chửi thề", "văng tục"],
  },
  {
    stt: 11,
    category: "II",
    categoryTitle: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)",
    name: "Thái độ không phù hợp với Cờ đỏ",
    points: 10,
    keywords: ["thái độ không phù hợp với cờ đỏ", "thái độ với cờ đỏ", "chống đối cờ đỏ"],
  },

  // III. TỰ CHỦ (Nề nếp giờ học, An toàn mạng & Văn minh học đường)
  {
    stt: 12,
    category: "III",
    categoryTitle: "III. TỰ CHỦ (Nề nếp giờ học, An toàn mạng & Văn minh học đường)",
    name: "Mua đồ ăn qua hàng rào; Mua - bán đồ ăn vặt trong trường lớp",
    points: 10,
    keywords: ["hàng rào", "đồ ăn vặt", "mua đồ ăn", "bán đồ ăn"],
  },
  {
    stt: 13,
    category: "III",
    categoryTitle: "III. TỰ CHỦ (Nề nếp giờ học, An toàn mạng & Văn minh học đường)",
    name: "Chạy, nhảy, nô đùa, nói chuyện lớn tiếng khi qua hành lang nhà hiệu bộ",
    points: 10,
    keywords: ["hành lang", "hiệu bộ", "chạy, nhảy", "nô đùa", "lớn tiếng"],
  },
  {
    stt: 14,
    category: "III",
    categoryTitle: "III. TỰ CHỦ (Nề nếp giờ học, An toàn mạng & Văn minh học đường)",
    name: "Đăng tải, chia sẻ thông tin sai sự thật, kích động, chống phá, xúc phạm người khác trên MXH",
    points: 20,
    keywords: ["mxh", "mạng xã hội", "sai sự thật", "kích động", "chống phá", "xúc phạm"],
  },

  // IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)
  {
    stt: 15,
    category: "IV",
    categoryTitle: "IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)",
    name: "Để xe không đúng quy định trong nhà xe, thiếu mã QR",
    points: 3,
    keywords: ["để xe", "nhà xe", "mã qr", "thiếu qr"],
  },
  {
    stt: 16,
    category: "IV",
    categoryTitle: "IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)",
    name: "Học sinh hút thuốc lá, thuốc lá điện tử, thuốc lào",
    points: 20,
    keywords: ["hút thuốc", "thuốc lá", "thuốc lào", "điện tử", "pod", "vape"],
  },
  {
    stt: 17,
    category: "IV",
    categoryTitle: "IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)",
    name: "Vi phạm ATGT (không mũ/không quai, xe phân khối lớn, pô chế, không biển, dàn hàng, để xe ngoài cổng)",
    points: 20,
    keywords: ["atgt", "mũ bảo hiểm", "không mũ", "không quai", "xe phân khối", "pô chế", "không biển", "dàn hàng", "xe ngoài cổng"],
  },
  {
    stt: 18,
    category: "IV",
    categoryTitle: "IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)",
    name: "Lớp có học sinh đánh nhau, bạo lực học đường",
    points: 20,
    keywords: ["đánh nhau", "bạo lực học đường", "bạo lực"],
  },

  // V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)
  {
    stt: 19,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Thiếu 01 dụng cụ vệ sinh (chậu nước, xô rác, khăn lau tay, khăn lau bảng)",
    points: 3,
    keywords: ["dụng cụ vệ sinh", "chậu nước", "xô rác", "khăn lau"],
  },
  {
    stt: 20,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Lớp có Cờ đỏ / Trực tuần trực muộn từ 3 phút trở lên",
    points: 3,
    keywords: ["trực muộn từ 3 phút", "trực muộn", "cờ đỏ trực muộn", "trực tuần trực muộn"],
  },
  {
    stt: 21,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Trực nhật, vệ sinh tự quản muộn, bẩn, không đổ rác, khu nước bẩn/ướt",
    points: 5,
    keywords: ["trực nhật", "vệ sinh tự quản", "không đổ rác", "khu nước bẩn", "vệ sinh bẩn"],
  },
  {
    stt: 22,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Không có thư viện góc lớp hoặc thư viện lộn xộn",
    points: 5,
    keywords: ["thư viện góc lớp", "thư viện lộn xộn", "thư viện"],
  },
  {
    stt: 23,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Không trực nhật / không vệ sinh khu vực tự quản",
    points: 10,
    keywords: ["không trực nhật", "không vệ sinh"],
  },
  {
    stt: 24,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Sử dụng điện/nước không tiết kiệm hoặc không đúng mục đích",
    points: 10,
    keywords: ["điện/nước", "lãng phí điện", "lãng phí nước", "điện nước"],
  },
  {
    stt: 25,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Làm hư hỏng thiết bị dùng chung / khu CTTN / gây mất vệ sinh khu nước sạch",
    points: 10,
    keywords: ["hư hỏng thiết bị", "thiết bị dùng chung", "khu cttn", "khu nước sạch"],
  },
  {
    stt: 26,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Không trực Cờ đỏ",
    points: 10,
    keywords: ["không trực cờ đỏ", "bỏ trực cờ đỏ", "vắng trực cờ đỏ"],
  },
  {
    stt: 27,
    category: "V",
    categoryTitle: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)",
    name: "Lớp trực tuần hoặc Cờ đỏ không có thông tin/báo cáo trực",
    points: 20,
    keywords: ["không có thông tin", "báo cáo trực", "không báo cáo"],
  },
];

const DISCLAIMER_TEXT =
  "* Lưu ý: Chưa bao gồm điểm thưởng và điểm giờ học. Chi tiết vi phạm xem tại codo2bt.vercel.app/bang-bao-cao-vi-pham";

function normalizeVi(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .trim();
}

/**
 * Match a violation record to one of the 27 standard criteria
 */
export function matchViolationToCriterion(v: {
  violationType?: string;
  details?: string;
  points?: number;
}): number | null {
  const vType = normalizeVi(v.violationType || "");
  const vDetails = normalizeVi(v.details || "");
  const haystack = `${vType} ${vDetails}`;

  // 1. Exact or startsWith match on criterion name
  for (const c of CRITERIA_5_TU) {
    const cNorm = normalizeVi(c.name);
    if (vType === cNorm || cNorm.includes(vType) || vType.includes(cNorm)) {
      return c.stt;
    }
  }

  // 2. Keyword matching with points consideration
  let bestMatch: { stt: number; score: number } | null = null;
  for (const c of CRITERIA_5_TU) {
    let score = 0;
    for (const kw of c.keywords) {
      const kwNorm = normalizeVi(kw);
      if (haystack.includes(kwNorm)) {
        score += kwNorm.length;
      }
    }
    if (score > 0) {
      if (v.points && v.points === c.points) {
        score += 50; // High bonus if points match exactly
      }
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { stt: c.stt, score };
      }
    }
  }

  return bestMatch ? bestMatch.stt : null;
}

export function getWeeklyRank(totalScore: number): string {
  if (totalScore >= 115) return "Xuất sắc";
  if (totalScore >= 105) return "Tốt";
  if (totalScore >= 90) return "Khá";
  return "Trung bình";
}

// ─── STYLES DEFINITION FOR EXCEL ───
const thinBorder = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
};

const styles = {
  schoolHeader: {
    font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "002060" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  docTitle: {
    font: { name: "Times New Roman", sz: 14, bold: true, color: { rgb: "002060" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  docSubtitle: {
    font: { name: "Times New Roman", sz: 11, italic: true, color: { rgb: "333333" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  disclaimer: {
    font: { name: "Times New Roman", sz: 10, italic: true, bold: true, color: { rgb: "C00000" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  infoClass: {
    font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "002060" } },
    alignment: { horizontal: "left", vertical: "center" },
  },
  infoWeekLabel: {
    font: { name: "Times New Roman", sz: 11, bold: true },
    fill: { fgColor: { rgb: "E2EFDA" } }, // Pale green
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  infoWeekValue: {
    font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "C00000" } },
    fill: { fgColor: { rgb: "E2EFDA" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  infoRankHeader: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "002060" } },
    alignment: { horizontal: "left", vertical: "center" },
  },
  summaryBannerLabel: {
    font: { name: "Times New Roman", sz: 11, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  summaryStandardScore: {
    font: { name: "Times New Roman", sz: 10, bold: true },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  },
  summaryDeduction: {
    font: { name: "Times New Roman", sz: 10, bold: true, color: { rgb: "C00000" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  },
  summaryFinalScore: {
    font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "1F4E79" } },
    fill: { fgColor: { rgb: "E2EFDA" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  tableHeaderCol: {
    font: { name: "Times New Roman", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4E79" } }, // Dark navy
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  },
  categoryHeader: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "2F5597" } }, // Medium dark blue
    alignment: { horizontal: "left", vertical: "center" },
    border: thinBorder,
  },
  sttCell: {
    font: { name: "Times New Roman", sz: 10 },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  criteriaCell: {
    font: { name: "Times New Roman", sz: 10 },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: thinBorder,
  },
  pointsCell: {
    font: { name: "Times New Roman", sz: 10, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  countCell: {
    font: { name: "Times New Roman", sz: 10, bold: true },
    fill: { fgColor: { rgb: "D9E1F2" } }, // Soft pale blue
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  deductionCell: {
    font: { name: "Times New Roman", sz: 10, bold: true },
    fill: { fgColor: { rgb: "E2EFDA" } }, // Soft pale green
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  detailsCell: {
    font: { name: "Times New Roman", sz: 10 },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: thinBorder,
  },
  footerNote: {
    font: { name: "Times New Roman", sz: 10, italic: true, color: { rgb: "595959" } },
    alignment: { horizontal: "right", vertical: "center" },
  },
  overviewHeader: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4E79" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  },
  overviewDataCenter: {
    font: { name: "Times New Roman", sz: 10 },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  overviewDataScore: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "1F4E79" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  rankTop1Cell: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "B25900" } },
    fill: { fgColor: { rgb: "FFF2CC" } }, // Gold pale
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  rankTop2Cell: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "333333" } },
    fill: { fgColor: { rgb: "F2F2F2" } }, // Silver
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  rankTop3Cell: {
    font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "804000" } },
    fill: { fgColor: { rgb: "FCE4D6" } }, // Bronze pale
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
  rankNormalCell: {
    font: { name: "Times New Roman", sz: 11, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  },
};

export interface ClassViolationData {
  className: string;
  totalPoints: number;
  violations: Array<{
    _id?: string;
    violatingClass?: string;
    violationDate?: number;
    violationType?: string;
    targetType?: "student" | "class";
    studentName?: string;
    details?: string;
    reporterName?: string;
    points?: number;
  }>;
}

export interface Export5TuOptions {
  scores: ClassViolationData[];
  weekNumber: number | string;
  dateRangeText?: string;
  creatorName: string;
  createdTime?: Date;
  schoolYearDecisionDate?: string; // Default: '26/08/2026'
  onProgress?: (current: number, total: number) => void;
}

export interface RankedClassData extends ClassViolationData {
  finalScore: number;
  rankLabel: string;
  rankOrder: number;
  grade: string;
}

/**
 * Compute dense ranking: cùng điểm thì cùng hạng
 * Sắp xếp điểm giảm dần (cao nhất xếp đầu).
 * Điểm bằng nhau -> cùng số hạng.
 */
export function computeClassRankings(scores: ClassViolationData[]): RankedClassData[] {
  // Sort by finalScore descending (120 - totalPoints)
  const sorted = [...scores].map((item) => {
    const finalScore = Math.max(0, 120 - item.totalPoints);
    const rankLabel = getWeeklyRank(finalScore);
    const gradeMatch = item.className.match(/^(10|11|12)/);
    const grade = gradeMatch ? `Khối ${gradeMatch[1]}` : "";
    return {
      ...item,
      finalScore,
      rankLabel,
      rankOrder: 1,
      grade,
    };
  });

  sorted.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    if (a.violations.length !== b.violations.length) {
      return a.violations.length - b.violations.length;
    }
    return a.className.localeCompare(b.className, "vi", { numeric: true });
  });

  // Dense rank: cùng điểm thì cùng hạng
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].finalScore < sorted[i - 1].finalScore) {
      currentRank++;
    }
    sorted[i].rankOrder = currentRank;
  }

  return sorted;
}

/**
 * Builds and downloads a multi-sheet Excel file matching the official 5-Tự inspection form.
 * Sheet 1 = "Xếp hạng" (Sắp xếp theo điểm, cùng điểm cùng hạng)
 * Sheet 2 = "Tổng hợp" (Danh sách toàn trường theo thứ tự lớp)
 * Sheet 3..N = 1 sheet per class (10A1, 10A2, ...)
 */
export async function export5TuExcelWorkbook({
  scores,
  weekNumber,
  dateRangeText,
  creatorName,
  createdTime = new Date(),
  schoolYearDecisionDate = "26/08/2026",
  onProgress,
}: Export5TuOptions): Promise<{ filename: string; sheetCount: number }> {
  const wb = XLSX.utils.book_new();

  // Document metadata
  const createdDateStr = format(createdTime, "dd/MM/yyyy HH:mm:ss");
  const footerText = `* Báo cáo được tạo tự động bởi ${creatorName}, vào lúc ${createdDateStr} trên trang CSDLCoDo2BT`;

  wb.Props = {
    Title: `Báo cáo nề nếp thi đua Tuần ${weekNumber}`,
    Subject: "Phiếu chấm điểm nề nếp thi đua học sinh (Mô hình 5 Tự)",
    Author: creatorName,
    Company: "CSDLCoDo2BT - THPT Số 2 Bảo Thắng",
    Comments: footerText,
    CreatedDate: createdTime,
  };

  // Compute dense ranking for all classes
  const rankedClasses = computeClassRankings(scores);

  // Class rank lookup map for quick access
  const rankMap = new Map<string, number>();
  rankedClasses.forEach((r) => rankMap.set(r.className, r.rankOrder));

  // Count classes at each rank to identify tied ranks
  const rankCountMap = new Map<number, number>();
  rankedClasses.forEach((r) => {
    rankCountMap.set(r.rankOrder, (rankCountMap.get(r.rankOrder) || 0) + 1);
  });

  // Classes sorted alphanumerically for overview and individual sheets
  const alphanumericScores = [...scores].sort((a, b) =>
    a.className.localeCompare(b.className, "vi", { numeric: true })
  );

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: XẾP HẠNG (Sắp xếp theo thứ tự điểm, cùng điểm cùng hạng)
  // ─────────────────────────────────────────────────────────────
  const rankSheetRows: any[][] = [];

  rankSheetRows.push([
    { v: "TRƯỜNG THPT SỐ 2 BẢO THẮNG - BAN CHẤP HÀNH ĐOÀN TRƯỜNG", s: styles.schoolHeader },
  ]);
  rankSheetRows.push([
    { v: `BẢNG XẾP HẠNG THI ĐUA NỀ NẾP CÁC LỚP - TUẦN ${weekNumber}`, s: styles.docTitle },
  ]);
  rankSheetRows.push([
    {
      v: dateRangeText
        ? `(Thời gian áp dụng: ${dateRangeText})`
        : `(Căn cứ Quyết định số 01-QĐ/ĐTN ngày ${schoolYearDecisionDate} của BCH Đoàn trường)`,
      s: styles.docSubtitle,
    },
  ]);
  rankSheetRows.push([
    { v: DISCLAIMER_TEXT, s: styles.disclaimer },
  ]);
  rankSheetRows.push([]); // Row 4: empty

  // Table header
  rankSheetRows.push([
    { v: "Hạng", s: styles.overviewHeader },
    { v: "Khối", s: styles.overviewHeader },
    { v: "Lớp", s: styles.overviewHeader },
    { v: "Điểm thi đua", s: styles.overviewHeader },
    { v: "Điểm chuẩn", s: styles.overviewHeader },
    { v: "Tổng điểm trừ", s: styles.overviewHeader },
    { v: "Xếp loại tuần", s: styles.overviewHeader },
    { v: "Số lượt vi phạm", s: styles.overviewHeader },
    { v: "Ghi chú", s: styles.overviewHeader },
  ]);

  rankedClasses.forEach((item) => {
    const isTied = (rankCountMap.get(item.rankOrder) || 0) > 1;
    const note = isTied ? `Đồng hạng ${item.rankOrder}` : "";

    let rankCellStyle = styles.rankNormalCell;
    if (item.rankOrder === 1) rankCellStyle = styles.rankTop1Cell;
    else if (item.rankOrder === 2) rankCellStyle = styles.rankTop2Cell;
    else if (item.rankOrder === 3) rankCellStyle = styles.rankTop3Cell;

    rankSheetRows.push([
      { v: item.rankOrder, s: rankCellStyle },
      { v: item.grade, s: styles.overviewDataCenter },
      { v: item.className, s: { ...styles.overviewDataCenter, font: { ...styles.overviewDataCenter.font, bold: true } } },
      { v: item.finalScore, s: styles.overviewDataScore },
      { v: 120, s: styles.overviewDataCenter },
      {
        v: item.totalPoints > 0 ? -item.totalPoints : 0,
        s: {
          ...styles.overviewDataCenter,
          font: {
            ...styles.overviewDataCenter.font,
            bold: item.totalPoints > 0,
            color: item.totalPoints > 0 ? { rgb: "C00000" } : { rgb: "000000" },
          },
        },
      },
      {
        v: item.rankLabel,
        s: {
          ...styles.overviewDataCenter,
          font: { ...styles.overviewDataCenter.font, bold: true },
        },
      },
      { v: item.violations.length, s: styles.overviewDataCenter },
      { v: note, s: styles.overviewDataCenter },
    ]);
  });

  rankSheetRows.push([]);
  rankSheetRows.push([{ v: footerText, s: styles.footerNote }]);

  const rankWs = XLSX.utils.aoa_to_sheet(rankSheetRows);
  rankWs["!cols"] = [
    { wch: 8 },  // Hạng
    { wch: 12 }, // Khối
    { wch: 12 }, // Lớp
    { wch: 16 }, // Điểm thi đua
    { wch: 14 }, // Điểm chuẩn
    { wch: 16 }, // Tổng điểm trừ
    { wch: 16 }, // Xếp loại tuần
    { wch: 18 }, // Số lượt vi phạm
    { wch: 20 }, // Ghi chú
  ];
  rankWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
    { s: { r: rankSheetRows.length - 1, c: 0 }, e: { r: rankSheetRows.length - 1, c: 8 } },
  ];

  XLSX.utils.book_append_sheet(wb, rankWs, "Xếp hạng");

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: TỔNG HỢP TOÀN TRƯỜNG (Theo thứ tự lớp học)
  // ─────────────────────────────────────────────────────────────
  const overviewRows: any[][] = [];

  overviewRows.push([
    { v: "TRƯỜNG THPT SỐ 2 BẢO THẮNG - BAN CHẤP HÀNH ĐOÀN TRƯỜNG", s: styles.schoolHeader },
  ]);
  overviewRows.push([
    { v: `BẢNG TỔNG HỢP ĐIỂM THI ĐUA NỀ NẾP CÁC LỚP - TUẦN ${weekNumber}`, s: styles.docTitle },
  ]);
  overviewRows.push([
    {
      v: dateRangeText
        ? `(Thời gian áp dụng: ${dateRangeText})`
        : `(Căn cứ Quyết định số 01-QĐ/ĐTN ngày ${schoolYearDecisionDate} của BCH Đoàn trường)`,
      s: styles.docSubtitle,
    },
  ]);
  overviewRows.push([
    { v: DISCLAIMER_TEXT, s: styles.disclaimer },
  ]);
  overviewRows.push([]); // Row 4: empty

  // Table header
  overviewRows.push([
    { v: "STT", s: styles.overviewHeader },
    { v: "Khối", s: styles.overviewHeader },
    { v: "Lớp", s: styles.overviewHeader },
    { v: "Hạng", s: styles.overviewHeader },
    { v: "Điểm chuẩn", s: styles.overviewHeader },
    { v: "Tổng điểm trừ", s: styles.overviewHeader },
    { v: "Điểm thi đua tuần", s: styles.overviewHeader },
    { v: "Xếp loại tuần", s: styles.overviewHeader },
    { v: "Số lượt vi phạm", s: styles.overviewHeader },
  ]);

  alphanumericScores.forEach((item, idx) => {
    const finalScore = Math.max(0, 120 - item.totalPoints);
    const rank = getWeeklyRank(finalScore);
    const gradeMatch = item.className.match(/^(10|11|12)/);
    const grade = gradeMatch ? `Khối ${gradeMatch[1]}` : "";
    const classRankOrder = rankMap.get(item.className) || 1;

    overviewRows.push([
      { v: idx + 1, s: styles.overviewDataCenter },
      { v: grade, s: styles.overviewDataCenter },
      { v: item.className, s: styles.overviewDataCenter },
      { v: classRankOrder, s: styles.overviewDataCenter },
      { v: 120, s: styles.overviewDataCenter },
      {
        v: item.totalPoints > 0 ? -item.totalPoints : 0,
        s: {
          ...styles.overviewDataCenter,
          font: {
            ...styles.overviewDataCenter.font,
            bold: item.totalPoints > 0,
            color: item.totalPoints > 0 ? { rgb: "C00000" } : { rgb: "000000" },
          },
        },
      },
      { v: finalScore, s: styles.overviewDataScore },
      {
        v: rank,
        s: {
          ...styles.overviewDataCenter,
          font: { ...styles.overviewDataCenter.font, bold: true },
        },
      },
      { v: item.violations.length, s: styles.overviewDataCenter },
    ]);
  });

  overviewRows.push([]);
  overviewRows.push([{ v: footerText, s: styles.footerNote }]);

  const overviewWs = XLSX.utils.aoa_to_sheet(overviewRows);
  overviewWs["!cols"] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Khối
    { wch: 12 }, // Lớp
    { wch: 8 },  // Hạng
    { wch: 14 }, // Điểm chuẩn
    { wch: 16 }, // Điểm trừ
    { wch: 18 }, // Điểm thi đua
    { wch: 16 }, // Xếp loại
    { wch: 18 }, // Số lượt
  ];
  overviewWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
    { s: { r: overviewRows.length - 1, c: 0 }, e: { r: overviewRows.length - 1, c: 8 } },
  ];

  XLSX.utils.book_append_sheet(wb, overviewWs, "Tổng hợp");

  // ─────────────────────────────────────────────────────────────
  // SHEETS 3..N: MỖI LỚP MỘT SHEET
  // ─────────────────────────────────────────────────────────────
  const totalClasses = alphanumericScores.length;

  for (let classIndex = 0; classIndex < totalClasses; classIndex++) {
    const classData = alphanumericScores[classIndex];
    if (onProgress) {
      onProgress(classIndex + 1, totalClasses);
    }

    const sheetRows: any[][] = [];
    const merges: XLSX.Range[] = [];

    // Row 0: Trường ...
    sheetRows.push([
      { v: "TRƯỜNG THPT SỐ 2 BẢO THẮNG - BAN CHẤP HÀNH ĐOÀN TRƯỜNG", s: styles.schoolHeader },
    ]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });

    // Row 1: Phiếu chấm điểm ...
    sheetRows.push([
      { v: "PHIẾU CHẤM ĐIỂM NỀ NẾP THI ĐUA HỌC SINH (MÔ HÌNH 5 TỰ)", s: styles.docTitle },
    ]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });

    // Row 2: Căn cứ QĐ ...
    sheetRows.push([
      {
        v: `(Căn cứ Quyết định số 01-QĐ/ĐTN ngày ${schoolYearDecisionDate} của BCH Đoàn trường)`,
        s: styles.docSubtitle,
      },
    ]);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 5 } });

    // Row 3: Disclaimer
    sheetRows.push([
      { v: DISCLAIMER_TEXT, s: styles.disclaimer },
    ]);
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 5 } });

    // Calculate score & rank
    const finalScore = Math.max(0, 120 - classData.totalPoints);
    const rank = getWeeklyRank(finalScore);

    // Row 4: Clean Info Row (Đã bỏ "lớp theo dõi (ghi rõ họ tên)" và bỏ "cờ đỏ chấm")
    sheetRows.push([
      { v: `Lớp:   ${classData.className}`, s: styles.infoClass },
      null,
      null,
      { v: "Tuần học", s: styles.infoWeekLabel },
      { v: String(weekNumber), s: styles.infoWeekValue },
      { v: `Xếp loại tuần:   ${rank}`, s: styles.infoRankHeader },
    ]);
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 2 } });

    // Row 5: TỔNG HỢP ĐIỂM THI ĐUA TUẦN
    sheetRows.push([
      { v: "TỔNG HỢP ĐIỂM THI ĐUA TUẦN", s: styles.summaryBannerLabel },
      null,
      null,
      { v: "Điểm\nchuẩn:\n120", s: styles.summaryStandardScore },
      { v: `Trừ NN\n& Giờ:\n${classData.totalPoints}`, s: styles.summaryDeduction },
      { v: finalScore, s: styles.summaryFinalScore },
    ]);
    merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: 2 } });

    // Row 6: Main Table Header
    sheetRows.push([
      { v: "STT", s: styles.tableHeaderCol },
      { v: "Nội dung vi phạm / Tiêu chí (Căn cứ QĐ 01-QĐ/ĐTN)", s: styles.tableHeaderCol },
      { v: "Mức\ntrừ\n(Điểm)", s: styles.tableHeaderCol },
      { v: "Số lượt\nvi\nphạm", s: styles.tableHeaderCol },
      { v: "Tổng\nđiểm\ntrừ", s: styles.tableHeaderCol },
      { v: "Tên HS vi phạm/ Minh chứng/ Ghi chú", s: styles.tableHeaderCol },
    ]);

    // Map class violations into criteria buckets
    const criterionMatches = new Map<number, typeof classData.violations>();
    const unmatchedViolations: typeof classData.violations = [];

    for (const v of classData.violations) {
      const matchedStt = matchViolationToCriterion(v);
      if (matchedStt != null) {
        if (!criterionMatches.has(matchedStt)) criterionMatches.set(matchedStt, []);
        criterionMatches.get(matchedStt)!.push(v);
      } else {
        unmatchedViolations.push(v);
      }
    }

    // Group criteria by categories
    const categories: Array<{ id: "I" | "II" | "III" | "IV" | "V"; title: string }> = [
      { id: "I", title: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)" },
      { id: "II", title: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)" },
      { id: "III", title: "III. TỰ CHỦ (Nề nếp giờ học, An toàn mạng & Văn minh học đường)" },
      { id: "IV", title: "IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)" },
      { id: "V", title: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)" },
    ];

    for (const cat of categories) {
      const catRowIndex = sheetRows.length;
      sheetRows.push([
        { v: cat.title, s: styles.categoryHeader },
        null,
        null,
        null,
        null,
        null,
      ]);
      merges.push({ s: { r: catRowIndex, c: 0 }, e: { r: catRowIndex, c: 5 } });

      const catCriteria = CRITERIA_5_TU.filter((c) => c.category === cat.id);
      for (const crit of catCriteria) {
        const matches = criterionMatches.get(crit.stt) || [];
        const count = matches.length;
        const totalDeduction = count * crit.points;

        const noteText = matches
          .map((m) => {
            const student = m.studentName?.trim() || "";
            const dateStr = m.violationDate
              ? format(new Date(m.violationDate), "dd/MM")
              : "";
            const details = m.details?.trim() || "";
            const parts: string[] = [];
            if (student) parts.push(student);
            else parts.push("Vi phạm tập thể");
            if (dateStr) parts.push(`(${dateStr})`);
            if (details) parts.push(`: ${details}`);
            return parts.join(" ");
          })
          .join(";\n");

        sheetRows.push([
          { v: crit.stt, s: styles.sttCell },
          { v: crit.name, s: styles.criteriaCell },
          { v: crit.points, s: styles.pointsCell },
          { v: count, s: styles.countCell },
          { v: totalDeduction, s: styles.deductionCell },
          { v: noteText, s: styles.detailsCell },
        ]);
      }
    }

    // If any unmatched violations exist, render under "Vi phạm khác"
    if (unmatchedViolations.length > 0) {
      const extraHeaderIdx = sheetRows.length;
      sheetRows.push([
        { v: "VI. CÁC VI PHẠM KHÁC (Bổ sung ngoài danh mục chuẩn)", s: styles.categoryHeader },
        null,
        null,
        null,
        null,
        null,
      ]);
      merges.push({ s: { r: extraHeaderIdx, c: 0 }, e: { r: extraHeaderIdx, c: 5 } });

      unmatchedViolations.forEach((extraV, extraIdx) => {
        const points = extraV.points || 0;
        const student = extraV.studentName?.trim() || "Vi phạm tập thể";
        const dateStr = extraV.violationDate
          ? format(new Date(extraV.violationDate), "dd/MM")
          : "";
        const details = extraV.details?.trim() || "";
        const note = `${student} ${dateStr ? `(${dateStr})` : ""}: ${details}`;

        sheetRows.push([
          { v: 27 + extraIdx + 1, s: styles.sttCell },
          { v: extraV.violationType || "Vi phạm khác", s: styles.criteriaCell },
          { v: points, s: styles.pointsCell },
          { v: 1, s: styles.countCell },
          { v: points, s: styles.deductionCell },
          { v: note, s: styles.detailsCell },
        ]);
      });
    }

    // Footer info
    sheetRows.push([]); // empty spacing row
    const footerRowIdx = sheetRows.length;
    sheetRows.push([
      { v: footerText, s: styles.footerNote },
      null,
      null,
      null,
      null,
      null,
    ]);
    merges.push({ s: { r: footerRowIdx, c: 0 }, e: { r: footerRowIdx, c: 5 } });

    // Build Worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws["!cols"] = [
      { wch: 6 },  // A: STT
      { wch: 48 }, // B: Nội dung vi phạm
      { wch: 12 }, // C: Mức trừ (Điểm)
      { wch: 14 }, // D: Số lượt vi phạm
      { wch: 14 }, // E: Tổng điểm trừ
      { wch: 55 }, // F: Tên HS vi phạm/ Minh chứng/ Ghi chú
    ];
    ws["!merges"] = merges;

    // Excel worksheet names must be <= 31 characters and free of invalid chars: \ / ? * [ ] :
    const cleanSheetName = classData.className
      .replace(/[/\\?*[\]:]/g, "_")
      .slice(0, 31);

    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  }

  // ─────────────────────────────────────────────────────────────
  // GENERATE FILE IN BROWSER
  // ─────────────────────────────────────────────────────────────
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const dateSlug = format(createdTime, "yyyy-MM-dd");
  const filename = `Phieu-cham-diem-ne-nep-Tuan-${weekNumber}-${dateSlug}.xlsx`;

  // Trigger browser download via object URL
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return {
    filename,
    sheetCount: 2 + totalClasses, // Xếp hạng + Tổng hợp + Các lớp
  };
}
