const ExcelJS = require("exceljs");
const path = require("path");

const workbook = new ExcelJS.Workbook();
workbook.creator = "Hironao-Takagi";
workbook.created = new Date();

// ─── カラー定義 ───────────────────────────────────────────────
const COLOR = {
  headerBg:    "FF4B5563", // ダークグレー
  headerFont:  "FFFFFFFF", // 白
  groupBg: {
    "タスク追加":       "FFE8F0FE",
    "繰り返し設定":     "FFEAF5EA",
    "タスク完了":       "FFFFF3CD",
    "タスク編集":       "FFFCE8E6",
    "タスク削除":       "FFF3E8FD",
    "フィルタリング":   "FFE8F5E9",
    "カレンダー表示":   "FFFFE0B2",
    "データ永続化":     "FFE1F5FE",
    "セキュリティ":     "FFFDE8E8",
  },
  borderColor: "FFB0B0B0",
  resultBg:    "FFFAFAFA",
  altRow:      "FFF9FAFB",
};

// ─── テストケースデータ ───────────────────────────────────────
const testCases = [
  // タスク追加
  { id:"T-01-01", category:"タスク追加",     title:"正常追加",                   steps:"①タスク名を入力\n②開始予定日を選択\n③終了予定日を選択\n④「追加」ボタン押下",                              expected:"タスクが一覧に追加される。入力フォームがリセットされる" },
  { id:"T-01-02", category:"タスク追加",     title:"タスク名未入力",             steps:"①タスク名を空のまま\n②日付を入力\n③「追加」ボタン押下",                                                 expected:"「タスク名を入力してください」エラーが表示され、追加されない" },
  { id:"T-01-03", category:"タスク追加",     title:"開始予定日未入力",           steps:"①タスク名を入力\n②開始予定日を空のまま\n③終了予定日を入力\n④「追加」ボタン押下",                       expected:"開始予定日フィールドにエラー表示、追加されない" },
  { id:"T-01-04", category:"タスク追加",     title:"終了予定日未入力",           steps:"①タスク名を入力\n②開始予定日を入力\n③終了予定日を空のまま\n④「追加」ボタン押下",                       expected:"終了予定日フィールドにエラー表示、追加されない" },
  { id:"T-01-05", category:"タスク追加",     title:"全項目未入力",               steps:"①何も入力せず「追加」ボタン押下",                                                                         expected:"タスク名・開始予定日・終了予定日の全てにエラー表示、追加されない" },
  { id:"T-01-06", category:"タスク追加",     title:"Enterキーで追加",            steps:"①全項目を入力\n②Enterキー押下",                                                                           expected:"タスクが追加される" },
  { id:"T-01-07", category:"タスク追加",     title:"スペースのみのタスク名",     steps:"①タスク名にスペースのみ入力\n②日付を入力\n③「追加」ボタン押下",                                          expected:"エラーが表示され追加されない（trim()後に空文字チェック）" },
  // 繰り返し設定
  { id:"T-02-01", category:"繰り返し設定",   title:"繰り返しなし（デフォルト）", steps:"①繰り返しを「なし」で登録",                                                                               expected:"指定した予定期間のみタスクが表示される" },
  { id:"T-02-02", category:"繰り返し設定",   title:"毎日繰り返し",               steps:"①繰り返しを「毎日」で登録",                                                                               expected:"開始日以降、カレンダーの全日にタスクが表示される" },
  { id:"T-02-03", category:"繰り返し設定",   title:"平日のみ繰り返し",           steps:"①繰り返しを「平日のみ」で登録",                                                                           expected:"開始日以降の月〜金のみ表示される。土日は表示されない" },
  { id:"T-02-04", category:"繰り返し設定",   title:"毎週繰り返し（曜日指定）",   steps:"①繰り返しを「毎週」で選択\n②曜日ボタンで「月」「水」を選択\n③登録",                                    expected:"開始日以降の月曜・水曜のみタスクが表示される" },
  { id:"T-02-05", category:"繰り返し設定",   title:"毎月繰り返し",               steps:"①開始日を4月3日で「毎月」設定\n②登録",                                                                   expected:"毎月3日にタスクが表示される" },
  { id:"T-02-06", category:"繰り返し設定",   title:"毎年繰り返し",               steps:"①開始日を4月3日で「毎年」設定\n②登録",                                                                   expected:"毎年4月3日にタスクが表示される" },
  { id:"T-02-07", category:"繰り返し設定",   title:"完了後の次インスタンス生成", steps:"①「毎週」設定のタスクを完了する（実績日入力）",                                                           expected:"完了処理後、次の週の同曜日に新しいタスクが自動生成される" },
  // タスク完了
  { id:"T-03-01", category:"タスク完了",     title:"正常完了",                   steps:"①完了ボタン（○）押下\n②実績開始日・終了日を入力\n③「完了する」ボタン押下",                              expected:"タスクが完了状態になる。テキストに打ち消し線が付く" },
  { id:"T-03-02", category:"タスク完了",     title:"実績日未入力で完了不可",     steps:"①完了ボタン押下\n②実績日を空のまま「完了する」押下",                                                     expected:"エラーが表示され完了されない" },
  { id:"T-03-03", category:"タスク完了",     title:"完了のキャンセル",           steps:"①完了ボタン押下\n②「キャンセル」ボタン押下",                                                             expected:"完了パネルが閉じ、タスクは未完了のまま" },
  { id:"T-03-04", category:"タスク完了",     title:"完了済みを未完了に戻す",     steps:"①完了済みタスクの完了ボタンを再押下",                                                                    expected:"タスクが未完了に戻り、実績日がクリアされる" },
  { id:"T-03-05", category:"タスク完了",     title:"実績日の初期値確認",         steps:"①完了ボタン押下",                                                                                         expected:"実績開始日・終了日の初期値が本日の日付になっている" },
  // タスク編集
  { id:"T-04-01", category:"タスク編集",     title:"展開パネル表示",             steps:"①タスク右端の展開ボタン（∨）押下",                                                                       expected:"日付編集パネルが表示される（開始予定日・終了予定日・開始実績・終了実績）" },
  { id:"T-04-02", category:"タスク編集",     title:"日付の編集・保存",           steps:"①展開ボタン押下\n②任意の日付を変更\n③「保存」ボタン押下",                                               expected:"変更した日付が反映され、パネルが閉じる" },
  { id:"T-04-03", category:"タスク編集",     title:"展開パネルの折りたたみ",     steps:"①展開ボタン押下でパネル表示\n②再度展開ボタン押下",                                                       expected:"パネルが折りたたまれる" },
  { id:"T-04-04", category:"タスク編集",     title:"完了・展開パネルの排他制御", steps:"①完了ボタン押下（完了パネル表示中）\n②展開ボタン押下",                                                   expected:"展開パネルが開き、完了パネルが閉じる" },
  // タスク削除
  { id:"T-05-01", category:"タスク削除",     title:"個別削除",                   steps:"①タスク右端の削除ボタン（×）押下",                                                                       expected:"タスクが一覧から削除される" },
  { id:"T-05-02", category:"タスク削除",     title:"完了済み一括削除",           steps:"①完了済みタスクが1件以上存在する状態で「完了済みを削除」ボタン押下",                                     expected:"完了済みタスクが全て削除される。未完了タスクは残る" },
  { id:"T-05-03", category:"タスク削除",     title:"ボタン非表示（完了なし）",   steps:"①完了済みタスクが0件の状態を確認",                                                                        expected:"「完了済みを削除」ボタンが表示されない" },
  // フィルタリング
  { id:"T-06-01", category:"フィルタリング", title:"「すべて」フィルタ",         steps:"①「すべて」ボタン押下",                                                                                   expected:"完了・未完了すべてのタスクが表示される" },
  { id:"T-06-02", category:"フィルタリング", title:"「未完了」フィルタ",         steps:"①「未完了」ボタン押下",                                                                                   expected:"未完了タスクのみ表示される" },
  { id:"T-06-03", category:"フィルタリング", title:"「完了済み」フィルタ",       steps:"①「完了済み」ボタン押下",                                                                                 expected:"完了済みタスクのみ表示される" },
  { id:"T-06-04", category:"フィルタリング", title:"残件数表示",                 steps:"①タスクを複数登録し一部を完了",                                                                           expected:"フッターに「N件のタスクが残っています」と未完了件数が表示される" },
  // カレンダー表示
  { id:"T-07-01", category:"カレンダー表示", title:"カレンダー表示切替",         steps:"①「カレンダー」タブ押下",                                                                                 expected:"月間カレンダーが表示される" },
  { id:"T-07-02", category:"カレンダー表示", title:"リスト表示への戻り",         steps:"①「リスト」タブ押下",                                                                                     expected:"リストビューが表示される" },
  { id:"T-07-03", category:"カレンダー表示", title:"前月・次月ナビ",             steps:"①「<」「>」ボタン押下",                                                                                   expected:"表示月が切り替わる。年をまたぐ場合も正常に動作する" },
  { id:"T-07-04", category:"カレンダー表示", title:"日付クリックでタスク表示",   steps:"①タスクが存在する日付をクリック",                                                                         expected:"カレンダー下部にその日のタスク一覧が表示される" },
  { id:"T-07-05", category:"カレンダー表示", title:"期限超過タスクの色表示",     steps:"①終了予定日が過去のタスク（繰り返しなし・未完了）を登録",                                                 expected:"カレンダー上で赤色表示される" },
  { id:"T-07-06", category:"カレンダー表示", title:"完了済みタスクの色表示",     steps:"①完了済みタスクが存在する日を確認",                                                                        expected:"グレー表示される" },
  { id:"T-07-07", category:"カレンダー表示", title:"3件以上の省略表示",          steps:"①同じ日に3件以上タスクを登録",                                                                            expected:"セル内に最大2件表示、超過分は「+N」と表示される" },
  // データ永続化
  { id:"T-08-01", category:"データ永続化",   title:"リロード後のデータ保持",     steps:"①タスクを追加\n②ページをリロード（F5）",                                                                  expected:"追加したタスクが表示されている" },
  { id:"T-08-02", category:"データ永続化",   title:"ブラウザ再起動後の保持",     steps:"①タスクを追加\n②ブラウザを閉じて再起動\n③アプリにアクセス",                                             expected:"タスクが保持されている" },
  { id:"T-08-03", category:"データ永続化",   title:"localStorage確認",           steps:"①タスクを追加\n②開発者ツール→Application→LocalStorageを確認",                                           expected:"todos-v2 キーにJSONデータが保存されている" },
  // セキュリティ
  { id:"T-09-01", category:"セキュリティ",   title:"CSPヘッダの確認",            steps:"①開発者ツール→Network→ページリクエストのResponseヘッダを確認",                                           expected:"Content-Security-Policy ヘッダが存在する" },
  { id:"T-09-02", category:"セキュリティ",   title:"X-Frame-Optionsの確認",      steps:"①同上",                                                                                                   expected:"X-Frame-Options: DENY が存在する" },
  { id:"T-09-03", category:"セキュリティ",   title:"X-Content-Type-Optionsの確認",steps:"①同上",                                                                                                  expected:"X-Content-Type-Options: nosniff が存在する" },
  { id:"T-09-04", category:"セキュリティ",   title:"Referrer-Policyの確認",      steps:"①同上",                                                                                                   expected:"Referrer-Policy: strict-origin-when-cross-origin が存在する" },
  { id:"T-09-05", category:"セキュリティ",   title:"Permissions-Policyの確認",   steps:"①同上",                                                                                                   expected:"Permissions-Policy ヘッダが存在する" },
];

// ─── ヘルパー関数 ──────────────────────────────────────────────
function applyBorder(cell) {
  cell.border = {
    top:    { style: "thin", color: { argb: COLOR.borderColor } },
    left:   { style: "thin", color: { argb: COLOR.borderColor } },
    bottom: { style: "thin", color: { argb: COLOR.borderColor } },
    right:  { style: "thin", color: { argb: COLOR.borderColor } },
  };
}

function setHeader(cell, value) {
  cell.value = value;
  cell.font = { bold: true, color: { argb: COLOR.headerFont }, size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerBg } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  applyBorder(cell);
}

function setCell(cell, value, bgColor, align = "left") {
  cell.value = value;
  cell.font = { size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
  cell.alignment = { vertical: "top", horizontal: align, wrapText: true };
  applyBorder(cell);
}

// ════════════════════════════════════════════════════════════════
// シート1：テストケース一覧
// ════════════════════════════════════════════════════════════════
const sheet1 = workbook.addWorksheet("テストケース一覧", {
  views: [{ state: "frozen", xSplit: 0, ySplit: 3 }],
});

// タイトル行
sheet1.mergeCells("A1:I1");
const titleCell = sheet1.getCell("A1");
titleCell.value = "ToDoリストアプリケーション　テスト仕様書";
titleCell.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
titleCell.alignment = { vertical: "middle", horizontal: "center" };
titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
sheet1.getRow(1).height = 30;

// 作成日行
sheet1.mergeCells("A2:I2");
const infoCell = sheet1.getCell("A2");
infoCell.value = "作成日：2026-04-03　　作成者：Hironao-Takagi　　バージョン：1.0";
infoCell.font = { size: 10, color: { argb: "FF6B7280" } };
infoCell.alignment = { vertical: "middle", horizontal: "right" };
infoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
sheet1.getRow(2).height = 18;

// ヘッダー行
const headers = ["No.", "テストID", "カテゴリ", "テスト項目", "テスト手順", "期待結果", "実施日", "実施者", "結果"];
const headerRow = sheet1.getRow(3);
headerRow.height = 22;
headers.forEach((h, i) => setHeader(headerRow.getCell(i + 1), h));

// 列幅
sheet1.getColumn(1).width = 5;   // No.
sheet1.getColumn(2).width = 11;  // テストID
sheet1.getColumn(3).width = 16;  // カテゴリ
sheet1.getColumn(4).width = 26;  // テスト項目
sheet1.getColumn(5).width = 40;  // テスト手順
sheet1.getColumn(6).width = 46;  // 期待結果
sheet1.getColumn(7).width = 12;  // 実施日
sheet1.getColumn(8).width = 10;  // 実施者
sheet1.getColumn(9).width = 8;   // 結果

// データ行
testCases.forEach((tc, idx) => {
  const rowNum = idx + 4;
  const row = sheet1.getRow(rowNum);
  row.height = Math.max(40, tc.steps.split("\n").length * 16);

  const bg = idx % 2 === 0
    ? (COLOR.groupBg[tc.category] || "FFFFFFFF")
    : COLOR.altRow;

  setCell(row.getCell(1), idx + 1,     bg, "center");
  setCell(row.getCell(2), tc.id,       bg, "center");
  setCell(row.getCell(3), tc.category, bg, "center");
  setCell(row.getCell(4), tc.title,    bg);
  setCell(row.getCell(5), tc.steps,    bg);
  setCell(row.getCell(6), tc.expected, bg);
  setCell(row.getCell(7), "",          COLOR.resultBg, "center");
  setCell(row.getCell(8), "",          COLOR.resultBg, "center");

  // 結果セル（ドロップダウン）
  const resultCell = row.getCell(9);
  setCell(resultCell, "-", COLOR.resultBg, "center");
  resultCell.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"○,×,-"'],
    showDropDown: false,
    showErrorMessage: true,
    errorTitle: "入力エラー",
    error: "○、×、- のいずれかを選択してください",
  };
});

// ════════════════════════════════════════════════════════════════
// シート2：結果サマリー
// ════════════════════════════════════════════════════════════════
const sheet2 = workbook.addWorksheet("結果サマリー", {
  views: [{ state: "frozen", xSplit: 0, ySplit: 3 }],
});

// タイトル
sheet2.mergeCells("A1:F1");
const s2title = sheet2.getCell("A1");
s2title.value = "テスト結果サマリー";
s2title.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
s2title.alignment = { vertical: "middle", horizontal: "center" };
s2title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
sheet2.getRow(1).height = 30;

sheet2.mergeCells("A2:F2");
sheet2.getRow(2).height = 10;

// カテゴリ別集計ヘッダー
sheet2.getRow(3).height = 22;
["カテゴリ", "テスト件数", "合格（○）", "不合格（×）", "未実施（-）", "合格率"].forEach((h, i) => {
  setHeader(sheet2.getRow(3).getCell(i + 1), h);
});

const categories = [...new Set(testCases.map((t) => t.category))];
const categoryCounts = categories.map((cat) => ({
  category: cat,
  count: testCases.filter((t) => t.category === cat).length,
}));

categoryCounts.forEach((c, idx) => {
  const row = sheet2.getRow(idx + 4);
  row.height = 20;
  const bg = COLOR.groupBg[c.category] || "FFFFFFFF";
  setCell(row.getCell(1), c.category, bg);
  setCell(row.getCell(2), c.count,    bg, "center");
  setCell(row.getCell(3), 0,          bg, "center");
  setCell(row.getCell(4), 0,          bg, "center");
  setCell(row.getCell(5), c.count,    bg, "center");
  setCell(row.getCell(6), "0%",       bg, "center");
});

// 合計行
const totalRow = sheet2.getRow(4 + categories.length);
totalRow.height = 22;
const totalCount = testCases.length;
["合計", totalCount, 0, 0, totalCount, "0%"].forEach((v, i) => {
  const cell = totalRow.getCell(i + 1);
  cell.value = v;
  cell.font = { bold: true, size: 10, color: { argb: "FF1F2937" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1D5DB" } };
  cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
  applyBorder(cell);
});

// 列幅
[20, 12, 12, 12, 12, 10].forEach((w, i) => { sheet2.getColumn(i + 1).width = w; });

// 凡例
const legendRow = 4 + categories.length + 2;
sheet2.getRow(legendRow).height = 18;
sheet2.mergeCells(`A${legendRow}:F${legendRow}`);
const legendTitle = sheet2.getCell(`A${legendRow}`);
legendTitle.value = "【判定基準】";
legendTitle.font = { bold: true, size: 10 };

[
  ["○", "合格：期待結果通りに動作する"],
  ["×", "不合格：期待結果と異なる動作をする"],
  ["-", "未実施：テスト未実施"],
].forEach(([mark, desc], i) => {
  const r = legendRow + 1 + i;
  sheet2.getRow(r).height = 16;
  sheet2.getCell(`A${r}`).value = `  ${mark}  ${desc}`;
  sheet2.getCell(`A${r}`).font = { size: 10 };
  sheet2.mergeCells(`A${r}:F${r}`);
});

// ════════════════════════════════════════════════════════════════
// シート3：不具合管理
// ════════════════════════════════════════════════════════════════
const sheet3 = workbook.addWorksheet("不具合管理");

sheet3.mergeCells("A1:H1");
const s3title = sheet3.getCell("A1");
s3title.value = "不具合管理表";
s3title.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
s3title.alignment = { vertical: "middle", horizontal: "center" };
s3title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
sheet3.getRow(1).height = 30;

sheet3.mergeCells("A2:H2");
sheet3.getRow(2).height = 10;

const bugHeaders = ["No.", "発見日", "テストID", "不具合内容", "重大度", "状態", "修正日", "備考"];
const bugHeaderRow = sheet3.getRow(3);
bugHeaderRow.height = 22;
bugHeaders.forEach((h, i) => setHeader(bugHeaderRow.getCell(i + 1), h));

// 空行を10行追加
for (let i = 4; i <= 13; i++) {
  const row = sheet3.getRow(i);
  row.height = 20;
  bugHeaders.forEach((_, j) => {
    const cell = row.getCell(j + 1);
    cell.value = "";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? COLOR.altRow : "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    applyBorder(cell);
  });

  // 重大度ドロップダウン
  sheet3.getCell(`E${i}`).dataValidation = {
    type: "list",
    formulae: ['"高,中,低"'],
    showDropDown: false,
  };
  // 状態ドロップダウン
  sheet3.getCell(`F${i}`).dataValidation = {
    type: "list",
    formulae: ['"未対応,対応中,修正済み,却下"'],
    showDropDown: false,
  };
}

// 列幅
[5, 12, 11, 40, 8, 10, 12, 20].forEach((w, i) => { sheet3.getColumn(i + 1).width = w; });

// ════════════════════════════════════════════════════════════════
// シート4：バージョン管理
// ════════════════════════════════════════════════════════════════
const sheet4 = workbook.addWorksheet("バージョン管理");

// タイトル
sheet4.mergeCells("A1:G1");
const s4title = sheet4.getCell("A1");
s4title.value = "バージョン管理表";
s4title.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
s4title.alignment = { vertical: "middle", horizontal: "center" };
s4title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
sheet4.getRow(1).height = 30;

sheet4.mergeCells("A2:G2");
sheet4.getRow(2).height = 10;

// ヘッダー行
const verHeaders = ["バージョン", "更新日", "更新者", "更新種別", "更新内容", "レビュアー", "承認日"];
const verHeaderRow = sheet4.getRow(3);
verHeaderRow.height = 22;
verHeaders.forEach((h, i) => setHeader(verHeaderRow.getCell(i + 1), h));

// 初版データ
const initialVersions = [
  {
    ver: "1.0",
    date: "2026-04-03",
    author: "Hironao-Takagi",
    type: "新規作成",
    content: "テスト仕様書 初版作成。全45件のテストケースを定義。",
    reviewer: "",
    approvedDate: "",
  },
];

initialVersions.forEach((v, idx) => {
  const row = sheet4.getRow(idx + 4);
  row.height = 24;
  const bg = idx % 2 === 0 ? "FFEEF2FF" : COLOR.altRow;

  setCell(row.getCell(1), v.ver,          bg, "center");
  setCell(row.getCell(2), v.date,         bg, "center");
  setCell(row.getCell(3), v.author,       bg, "center");
  setCell(row.getCell(4), v.type,         bg, "center");
  setCell(row.getCell(5), v.content,      bg);
  setCell(row.getCell(6), v.reviewer,     bg, "center");
  setCell(row.getCell(7), v.approvedDate, bg, "center");

  // 更新種別ドロップダウン
  row.getCell(4).dataValidation = {
    type: "list",
    formulae: ['"新規作成,テストケース追加,テストケース修正,テストケース削除,誤字修正,その他"'],
    showDropDown: false,
  };
});

// 空行を15行追加（今後の更新用）
for (let i = 4 + initialVersions.length; i <= 4 + initialVersions.length + 14; i++) {
  const row = sheet4.getRow(i);
  row.height = 24;
  const bg = (i % 2 === 0) ? COLOR.altRow : "FFFFFFFF";
  verHeaders.forEach((_, j) => {
    const cell = row.getCell(j + 1);
    cell.value = "";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.alignment = { vertical: "middle", horizontal: j === 4 ? "left" : "center", wrapText: true };
    applyBorder(cell);
  });
  // 更新種別ドロップダウン
  row.getCell(4).dataValidation = {
    type: "list",
    formulae: ['"新規作成,テストケース追加,テストケース修正,テストケース削除,誤字修正,その他"'],
    showDropDown: false,
  };
}

// 列幅
[14, 13, 16, 18, 50, 16, 13].forEach((w, i) => { sheet4.getColumn(i + 1).width = w; });

// 記入ガイド
const guideStartRow = 4 + initialVersions.length + 15 + 2;
sheet4.mergeCells(`A${guideStartRow}:G${guideStartRow}`);
const guideTitle = sheet4.getCell(`A${guideStartRow}`);
guideTitle.value = "【記入ガイド】";
guideTitle.font = { bold: true, size: 10 };
guideTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
sheet4.getRow(guideStartRow).height = 18;

const guides = [
  "バージョン  ：  変更規模に応じてメジャー（1.0→2.0）またはマイナー（1.0→1.1）で採番してください",
  "更新日      ：  ドキュメントを更新した日付を YYYY-MM-DD 形式で記入してください",
  "更新者      ：  更新を行った担当者名を記入してください",
  "更新種別    ：  ドロップダウンから最も近い種別を選択してください",
  "更新内容    ：  追加・変更・削除したテストケースのIDと変更理由を具体的に記入してください",
  "レビュアー  ：  内容を確認した担当者名を記入してください（任意）",
  "承認日      ：  責任者が承認した日付を記入してください（任意）",
];

guides.forEach((text, i) => {
  const r = guideStartRow + 1 + i;
  sheet4.mergeCells(`A${r}:G${r}`);
  const cell = sheet4.getCell(`A${r}`);
  cell.value = `  ${text}`;
  cell.font = { size: 10, color: { argb: "FF4B5563" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  sheet4.getRow(r).height = 16;
});

// ════════════════════════════════════════════════════════════════
// 出力
// ════════════════════════════════════════════════════════════════
const outPath = path.join(__dirname, "../docs/テスト仕様書.xlsx");
workbook.xlsx.writeFile(outPath).then(() => {
  console.log(`✅ 作成完了: ${outPath}`);
  console.log(`   テストケース数: ${testCases.length} 件`);
  console.log(`   シート: テストケース一覧 / 結果サマリー / 不具合管理`);
}).catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
