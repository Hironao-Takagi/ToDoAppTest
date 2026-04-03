/**
 * E2Eテスト仕様書対応テスト
 * テスト仕様書: docs/テスト仕様書.md
 *
 * 実行方法:
 *   npx playwright test
 *
 * 必要なインストール:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 */

import { test, expect, Page } from "@playwright/test";

// ─── ヘルパー関数 ──────────────────────────────────────────────────────────────

/** タスクを追加するヘルパー */
async function addTask(
  page: Page,
  text: string,
  plannedStart: string,
  plannedEnd: string,
  recurrence: "なし" | "毎日" | "平日のみ" | "毎週" | "毎月" | "毎年" = "なし"
) {
  await page.getByPlaceholder("新しいタスクを入力...").fill(text);
  await page.getByLabel("開始予定日 *").fill(plannedStart);
  await page.getByLabel("終了予定日 *").fill(plannedEnd);
  if (recurrence !== "なし") {
    await page.getByRole("button", { name: recurrence, exact: true }).click();
  }
  await page.getByRole("button", { name: "追加" }).click();
}

/** タスク行を取得するヘルパー（data-testid="todo-item" を使用） */
function getTaskRow(page: Page, taskText: string) {
  return page.locator("[data-testid='todo-item']").filter({ hasText: taskText });
}

/** タスクを完了するヘルパー */
async function completeTask(
  page: Page,
  taskText: string,
  actualStart: string,
  actualEnd: string
) {
  const taskRow = getTaskRow(page, taskText);
  await taskRow.getByRole("button", { name: "完了にする" }).click();
  await page.getByLabel("開始実績").fill(actualStart);
  await page.getByLabel("終了実績").fill(actualEnd);
  await page.getByRole("button", { name: "完了する" }).click();
}

// ─── 各テスト前の共通処理 ────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // localStorageをクリアして初期状態にする
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("h1", { state: "visible" });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.1 タスク追加（F-01）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("タスク追加（F-01）", () => {

  test("T-01-01: 正常追加", async ({ page }) => {
    await addTask(page, "清掃Aエリア", "2026-04-10", "2026-04-10");

    await expect(getTaskRow(page, "清掃Aエリア")).toBeVisible();
    await expect(page.getByPlaceholder("新しいタスクを入力...")).toHaveValue("");
  });

  test("T-01-02: タスク名未入力でエラー表示", async ({ page }) => {
    await page.getByLabel("開始予定日 *").fill("2026-04-10");
    await page.getByLabel("終了予定日 *").fill("2026-04-10");
    await page.getByRole("button", { name: "追加" }).click();

    await expect(page.getByText("タスク名を入力してください")).toBeVisible();
    await expect(page.locator("[data-testid='todo-item']")).toHaveCount(0);
  });

  test("T-01-03: 開始予定日未入力でエラー表示", async ({ page }) => {
    await page.getByPlaceholder("新しいタスクを入力...").fill("テストタスク");
    await page.getByLabel("終了予定日 *").fill("2026-04-10");
    await page.getByRole("button", { name: "追加" }).click();

    await expect(page.getByLabel("開始予定日 *")).toHaveClass(/border-red/);
    await expect(page.locator("[data-testid='todo-item']")).toHaveCount(0);
  });

  test("T-01-04: 終了予定日未入力でエラー表示", async ({ page }) => {
    await page.getByPlaceholder("新しいタスクを入力...").fill("テストタスク");
    await page.getByLabel("開始予定日 *").fill("2026-04-10");
    await page.getByRole("button", { name: "追加" }).click();

    await expect(page.getByLabel("終了予定日 *")).toHaveClass(/border-red/);
    await expect(page.locator("[data-testid='todo-item']")).toHaveCount(0);
  });

  test("T-01-05: 全項目未入力で全フィールドにエラー表示", async ({ page }) => {
    await page.getByRole("button", { name: "追加" }).click();

    await expect(page.getByText("タスク名を入力してください")).toBeVisible();
    await expect(page.getByLabel("開始予定日 *")).toHaveClass(/border-red/);
    await expect(page.getByLabel("終了予定日 *")).toHaveClass(/border-red/);
    await expect(page.locator("[data-testid='todo-item']")).toHaveCount(0);
  });

  test("T-01-06: Enterキーで追加", async ({ page }) => {
    await page.getByPlaceholder("新しいタスクを入力...").fill("Enterで追加タスク");
    await page.getByLabel("開始予定日 *").fill("2026-04-10");
    await page.getByLabel("終了予定日 *").fill("2026-04-10");
    await page.keyboard.press("Enter");

    await expect(getTaskRow(page, "Enterで追加タスク")).toBeVisible();
  });

  test("T-01-07: スペースのみのタスク名でエラー表示", async ({ page }) => {
    await page.getByPlaceholder("新しいタスクを入力...").fill("   ");
    await page.getByLabel("開始予定日 *").fill("2026-04-10");
    await page.getByLabel("終了予定日 *").fill("2026-04-10");
    await page.getByRole("button", { name: "追加" }).click();

    await expect(page.getByText("タスク名を入力してください")).toBeVisible();
    await expect(page.locator("[data-testid='todo-item']")).toHaveCount(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.2 繰り返し設定（F-09）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("繰り返し設定（F-09）", () => {

  test("T-02-01: 繰り返しなし（デフォルト）", async ({ page }) => {
    await addTask(page, "繰り返しなしタスク", "2026-04-10", "2026-04-12", "なし");
    await expect(getTaskRow(page, "繰り返しなしタスク")).toBeVisible();
  });

  test("T-02-02: 毎日繰り返し", async ({ page }) => {
    await addTask(page, "毎日タスク", "2026-04-10", "2026-04-10", "毎日");
    await expect(getTaskRow(page, "毎日タスク")).toBeVisible();
    // バッジはspan.rounded-full内に表示される
    await expect(getTaskRow(page, "毎日タスク").locator("span.rounded-full")).toContainText("毎日");
  });

  test("T-02-03: 平日のみ繰り返し", async ({ page }) => {
    await addTask(page, "平日タスク", "2026-04-07", "2026-04-07", "平日のみ");
    await expect(getTaskRow(page, "平日タスク")).toBeVisible();
    await expect(getTaskRow(page, "平日タスク").locator("span.rounded-full")).toContainText("平日のみ");
  });

  test("T-02-04: 毎週繰り返し（曜日指定）", async ({ page }) => {
    await page.getByPlaceholder("新しいタスクを入力...").fill("毎週タスク");
    await page.getByLabel("開始予定日 *").fill("2026-04-06");
    await page.getByLabel("終了予定日 *").fill("2026-04-06");
    await page.getByRole("button", { name: "毎週", exact: true }).click();

    await page.getByRole("button", { name: "月", exact: true }).click();
    await page.getByRole("button", { name: "水", exact: true }).click();
    await page.getByRole("button", { name: "追加" }).click();

    await expect(getTaskRow(page, "毎週タスク")).toBeVisible();
    await expect(getTaskRow(page, "毎週タスク").locator("span.rounded-full")).toContainText("毎週");
  });

  test("T-02-05: 毎月繰り返し", async ({ page }) => {
    await addTask(page, "毎月タスク", "2026-04-03", "2026-04-03", "毎月");
    await expect(getTaskRow(page, "毎月タスク")).toBeVisible();
    await expect(getTaskRow(page, "毎月タスク").locator("span.rounded-full")).toContainText("毎月");
  });

  test("T-02-06: 毎年繰り返し", async ({ page }) => {
    await addTask(page, "毎年タスク", "2026-04-03", "2026-04-03", "毎年");
    await expect(getTaskRow(page, "毎年タスク")).toBeVisible();
    await expect(getTaskRow(page, "毎年タスク").locator("span.rounded-full")).toContainText("毎年");
  });

  test("T-02-07: 繰り返し完了後の次インスタンス生成", async ({ page }) => {
    await addTask(page, "毎週繰り返しタスク", "2026-04-07", "2026-04-07", "毎週");

    const taskRow = getTaskRow(page, "毎週繰り返しタスク").first();
    await taskRow.getByRole("button", { name: "完了にする" }).click();
    await page.getByLabel("開始実績").fill("2026-04-07");
    await page.getByLabel("終了実績").fill("2026-04-07");
    await page.getByRole("button", { name: "完了する" }).click();

    // 次のインスタンス（翌週）が生成され、合計2件になること
    await expect(page.locator("[data-testid='todo-item']").filter({ hasText: "毎週繰り返しタスク" })).toHaveCount(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.3 タスク完了（F-03）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("タスク完了（F-03）", () => {

  test.beforeEach(async ({ page }) => {
    await addTask(page, "完了テストタスク", "2026-04-10", "2026-04-10");
  });

  test("T-03-01: 正常完了", async ({ page }) => {
    await getTaskRow(page, "完了テストタスク").getByRole("button", { name: "完了にする" }).click();
    await page.getByLabel("開始実績").fill("2026-04-10");
    await page.getByLabel("終了実績").fill("2026-04-10");
    await page.getByRole("button", { name: "完了する" }).click();

    // 打ち消し線が付くこと
    await expect(getTaskRow(page, "完了テストタスク").locator("p.line-through")).toBeVisible();
  });

  test("T-03-02: 実績日未入力で完了不可", async ({ page }) => {
    await getTaskRow(page, "完了テストタスク").getByRole("button", { name: "完了にする" }).click();
    await page.getByLabel("開始実績").clear();
    await page.getByLabel("終了実績").clear();
    await page.getByRole("button", { name: "完了する" }).click();

    // タスクは未完了のまま（打ち消し線なし）
    await expect(getTaskRow(page, "完了テストタスク").locator("p.line-through")).not.toBeVisible();
  });

  test("T-03-03: 完了のキャンセル", async ({ page }) => {
    await getTaskRow(page, "完了テストタスク").getByRole("button", { name: "完了にする" }).click();
    await expect(page.getByRole("button", { name: "完了する" })).toBeVisible();

    await page.getByRole("button", { name: "キャンセル" }).click();

    await expect(page.getByRole("button", { name: "完了する" })).not.toBeVisible();
    await expect(getTaskRow(page, "完了テストタスク").locator("p.line-through")).not.toBeVisible();
  });

  test("T-03-04: 完了済みを未完了に戻す", async ({ page }) => {
    // まず完了にする
    await getTaskRow(page, "完了テストタスク").getByRole("button", { name: "完了にする" }).click();
    await page.getByLabel("開始実績").fill("2026-04-10");
    await page.getByLabel("終了実績").fill("2026-04-10");
    await page.getByRole("button", { name: "完了する" }).click();

    // 完了状態のボタンを再押下して未完了に戻す
    await getTaskRow(page, "完了テストタスク").getByRole("button", { name: "未完了に戻す" }).click();

    await expect(getTaskRow(page, "完了テストタスク").locator("p.line-through")).not.toBeVisible();
  });

  test("T-03-05: 実績日の初期値が今日になっている", async ({ page }) => {
    const today = new Date().toISOString().split("T")[0];
    await getTaskRow(page, "完了テストタスク").getByRole("button", { name: "完了にする" }).click();

    await expect(page.getByLabel("開始実績")).toHaveValue(today);
    await expect(page.getByLabel("終了実績")).toHaveValue(today);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.4 タスク編集（F-04）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("タスク編集（F-04）", () => {

  test.beforeEach(async ({ page }) => {
    await addTask(page, "編集テストタスク", "2026-04-10", "2026-04-15");
  });

  test("T-04-01: 展開パネル表示", async ({ page }) => {
    await getTaskRow(page, "編集テストタスク").getByRole("button", { name: "詳細" }).click();

    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
  });

  test("T-04-02: 日付の編集・保存", async ({ page }) => {
    await getTaskRow(page, "編集テストタスク").getByRole("button", { name: "詳細" }).click();

    // 展開パネル内の最初のdate inputを変更
    await page.locator("[data-testid='todo-item']")
      .filter({ hasText: "編集テストタスク" })
      .locator("input[type='date']").first()
      .fill("2026-04-20");
    await page.getByRole("button", { name: "保存" }).click();

    // パネルが閉じること
    await expect(page.getByRole("button", { name: "保存" })).not.toBeVisible();
  });

  test("T-04-03: 展開パネルの折りたたみ", async ({ page }) => {
    await getTaskRow(page, "編集テストタスク").getByRole("button", { name: "詳細" }).click();
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();

    // 再度押下で折りたたむ
    await getTaskRow(page, "編集テストタスク").getByRole("button", { name: "詳細" }).click();
    await expect(page.getByRole("button", { name: "保存" })).not.toBeVisible();
  });

  test("T-04-04: 完了パネルと展開パネルの排他制御", async ({ page }) => {
    // 完了パネルを開く
    await getTaskRow(page, "編集テストタスク").getByRole("button", { name: "完了にする" }).click();
    await expect(page.getByRole("button", { name: "完了する" })).toBeVisible();

    // 展開ボタンを押すと完了パネルが閉じる
    await getTaskRow(page, "編集テストタスク").getByRole("button", { name: "詳細" }).click();
    await expect(page.getByRole("button", { name: "完了する" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.5 タスク削除（F-05・F-06）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("タスク削除（F-05・F-06）", () => {

  test("T-05-01: 個別削除", async ({ page }) => {
    await addTask(page, "削除対象タスク", "2026-04-10", "2026-04-10");
    await expect(getTaskRow(page, "削除対象タスク")).toBeVisible();

    await getTaskRow(page, "削除対象タスク").getByRole("button", { name: "削除" }).click();

    await expect(getTaskRow(page, "削除対象タスク")).not.toBeVisible();
  });

  test("T-05-02: 完了済み一括削除", async ({ page }) => {
    await addTask(page, "完了タスクA", "2026-04-10", "2026-04-10");
    await addTask(page, "未完了タスクB", "2026-04-10", "2026-04-10");

    await completeTask(page, "完了タスクA", "2026-04-10", "2026-04-10");

    await page.getByRole("button", { name: "完了済みを削除" }).click();

    await expect(getTaskRow(page, "完了タスクA")).not.toBeVisible();
    await expect(getTaskRow(page, "未完了タスクB")).toBeVisible();
  });

  test("T-05-03: 完了済みなし時のボタン非表示", async ({ page }) => {
    await addTask(page, "未完了タスク", "2026-04-10", "2026-04-10");

    await expect(page.getByRole("button", { name: "完了済みを削除" })).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.6 フィルタリング（F-07）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("フィルタリング（F-07）", () => {

  test.beforeEach(async ({ page }) => {
    await addTask(page, "未完了タスク", "2026-04-10", "2026-04-10");
    await addTask(page, "完了済みタスク", "2026-04-10", "2026-04-10");
    await completeTask(page, "完了済みタスク", "2026-04-10", "2026-04-10");
  });

  test("T-06-01: 「すべて」フィルタ", async ({ page }) => {
    await page.getByRole("button", { name: "すべて" }).click();

    await expect(getTaskRow(page, "未完了タスク")).toBeVisible();
    await expect(getTaskRow(page, "完了済みタスク")).toBeVisible();
  });

  test("T-06-02: 「未完了」フィルタ", async ({ page }) => {
    // exact: true で「未完了に戻す」ボタンと区別する
    await page.getByRole("button", { name: "未完了", exact: true }).click();

    await expect(getTaskRow(page, "未完了タスク")).toBeVisible();
    await expect(getTaskRow(page, "完了済みタスク")).not.toBeVisible();
  });

  test("T-06-03: 「完了済み」フィルタ", async ({ page }) => {
    await page.getByRole("button", { name: "完了済み", exact: true }).click();

    await expect(getTaskRow(page, "未完了タスク")).not.toBeVisible();
    await expect(getTaskRow(page, "完了済みタスク")).toBeVisible();
  });

  test("T-06-04: 残件数表示", async ({ page }) => {
    // フッターに「残り 1 件」が表示されること
    await expect(page.getByText(/残り.*1.*件/)).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.7 カレンダー表示（F-08）
// ══════════════════════════════════════════════════════════════════════════════

test.describe("カレンダー表示（F-08）", () => {

  test("T-07-01: カレンダー表示切替", async ({ page }) => {
    await page.getByRole("button", { name: "カレンダー" }).click();

    // 曜日ヘッダーを exact: true で指定して重複マッチを避ける
    await expect(page.getByText("月", { exact: true })).toBeVisible();
    await expect(page.getByText("火", { exact: true })).toBeVisible();
    await expect(page.getByText("水", { exact: true })).toBeVisible();
  });

  test("T-07-02: リスト表示への戻り", async ({ page }) => {
    await page.getByRole("button", { name: "カレンダー" }).click();
    await page.getByRole("button", { name: "リスト" }).click();

    await expect(page.getByPlaceholder("新しいタスクを入力...")).toBeVisible();
  });

  test("T-07-03: 前月・次月ナビ", async ({ page }) => {
    await page.getByRole("button", { name: "カレンダー" }).click();

    // 年月表示を取得（例: "2026年 4月"）
    const monthLabel = page.locator("span").filter({ hasText: /\d{4}年\s\d+月/ });
    const currentMonthText = await monthLabel.textContent();

    await page.getByRole("button", { name: "次月" }).click();
    const nextMonthText = await monthLabel.textContent();
    expect(nextMonthText).not.toBe(currentMonthText);

    await page.getByRole("button", { name: "前月" }).click();
    const backMonthText = await monthLabel.textContent();
    expect(backMonthText).toBe(currentMonthText);
  });

  test("T-07-03: 年またぎナビ", async ({ page }) => {
    await page.getByRole("button", { name: "カレンダー" }).click();

    const monthLabel = page.locator("span").filter({ hasText: /\d{4}年\s\d+月/ });
    for (let i = 0; i < 12; i++) {
      await page.getByRole("button", { name: "前月" }).click();
    }
    await expect(monthLabel).toBeVisible();
  });

  test("T-07-04: 日付クリックでタスク一覧表示", async ({ page }) => {
    const today = new Date().toISOString().split("T")[0];
    await addTask(page, "今日のタスク", today, today);
    await page.getByRole("button", { name: "カレンダー" }).click();

    const todayNum = new Date().getDate().toString();
    await page.getByText(todayNum, { exact: true }).first().click();

    // カレンダー選択日パネルにタスクが表示されること（first()で重複回避）
    await expect(page.getByText("今日のタスク").first()).toBeVisible();
  });

  test("T-07-05: 期限超過タスクの赤色表示（リストビュー）", async ({ page }) => {
    // 過去日付のタスクはリストビューでも赤色表示される
    await addTask(page, "期限超過タスク", "2020-01-01", "2020-01-01");

    // リストビューで期限超過の赤いボーダーを確認
    await expect(page.locator("[data-testid='todo-item']").filter({ hasText: "期限超過タスク" })).toHaveClass(/border-red/);
  });

  test("T-07-06: 完了済みタスクのグレー表示", async ({ page }) => {
    const today = new Date().toISOString().split("T")[0];
    await addTask(page, "完了済みカレンダータスク", today, today);
    await completeTask(page, "完了済みカレンダータスク", today, today);

    await page.getByRole("button", { name: "カレンダー" }).click();
    await expect(page.locator(".bg-stone-100, .text-stone-400").first()).toBeVisible();
  });

  test("T-07-07: 3件以上のタスク省略表示", async ({ page }) => {
    const today = new Date().toISOString().split("T")[0];
    await addTask(page, "タスク1", today, today);
    await addTask(page, "タスク2", today, today);
    await addTask(page, "タスク3", today, today);

    await page.getByRole("button", { name: "カレンダー" }).click();

    await expect(page.locator("text=/\\+\\d+/")).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.8 データ永続化
// ══════════════════════════════════════════════════════════════════════════════

test.describe("データ永続化", () => {

  test("T-08-01: ページリロード後のデータ保持", async ({ page }) => {
    await addTask(page, "永続化テストタスク", "2026-04-10", "2026-04-10");
    await page.reload();
    await page.waitForSelector("h1", { state: "visible" });

    await expect(getTaskRow(page, "永続化テストタスク")).toBeVisible();
  });

  test("T-08-03: localStorage に todos-v2 キーで保存される", async ({ page }) => {
    await addTask(page, "ストレージ確認タスク", "2026-04-10", "2026-04-10");

    const stored = await page.evaluate(() => localStorage.getItem("todos-v2"));
    expect(stored).not.toBeNull();

    const todos = JSON.parse(stored!);
    expect(Array.isArray(todos)).toBe(true);
    expect(todos.some((t: { text: string }) => t.text === "ストレージ確認タスク")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3.9 セキュリティヘッダ
// ══════════════════════════════════════════════════════════════════════════════

test.describe("セキュリティヘッダ", () => {

  test("T-09-01: Content-Security-Policy ヘッダが存在する", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toBeTruthy();
  });

  test("T-09-02: X-Frame-Options: DENY が存在する", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
  });

  test("T-09-03: X-Content-Type-Options: nosniff が存在する", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("T-09-04: Referrer-Policy ヘッダが存在する", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["referrer-policy"]).toBeTruthy();
  });

  test("T-09-05: Permissions-Policy ヘッダが存在する", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["permissions-policy"]).toBeTruthy();
  });
});
