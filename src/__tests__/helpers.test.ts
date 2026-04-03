/**
 * ユニットテスト — ヘルパー関数
 * テスト仕様書: docs/テスト仕様書.md（繰り返し設定 T-02、カレンダー T-07 の内部ロジック）
 *
 * 実行方法:
 *   npx vitest run
 *
 * 必要なインストール:
 *   npm install -D vitest
 *
 * 注意:
 *   現在これらの関数は page.tsx 内にあるため、テスト実行には
 *   src/lib/helpers.ts に切り出してエクスポートする必要があります。
 *   以下は切り出し後の想定テストコードです。
 */

import { describe, it, expect } from "vitest";

// ─── page.tsx から切り出す想定の関数（src/lib/helpers.ts へ移動）──────────────

type RecurrenceType = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
type Recurrence = { type: RecurrenceType; weekDays?: number[] };
type Todo = {
  id: string; text: string; completed: boolean; createdAt: number;
  plannedStart: string; plannedEnd: string;
  actualStart: string; actualEnd: string;
  recurrence: Recurrence;
};

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseYMD(str: string): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(str: string): string {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${y}/${m}/${d}`;
}

function occursOnDay(todo: Todo, dayStr: string): boolean {
  const day = parseYMD(dayStr);
  if (!day) return false;
  if (todo.completed && todo.recurrence.type !== "none") {
    const s = todo.plannedStart ? parseYMD(todo.plannedStart) : null;
    const e = todo.plannedEnd   ? parseYMD(todo.plannedEnd)   : null;
    if (s && e) return day >= s && day <= e;
    if (s) return dayStr === todo.plannedStart;
    if (e) return dayStr === todo.plannedEnd;
    return false;
  }
  const start = todo.plannedStart ? parseYMD(todo.plannedStart) : null;
  switch (todo.recurrence.type) {
    case "none": {
      const s = todo.plannedStart ? parseYMD(todo.plannedStart) : null;
      const e = todo.plannedEnd   ? parseYMD(todo.plannedEnd)   : null;
      if (s && e) return day >= s && day <= e;
      if (s) return dayStr === todo.plannedStart;
      if (e) return dayStr === todo.plannedEnd;
      return false;
    }
    case "daily":    return !!start && day >= start;
    case "weekdays": { const w = day.getDay(); return !!start && day >= start && w >= 1 && w <= 5; }
    case "weekly": {
      if (!start) return false;
      const weekDays = todo.recurrence.weekDays?.length ? todo.recurrence.weekDays : [start.getDay()];
      return day >= start && weekDays.includes(day.getDay());
    }
    case "monthly": return !!start && day >= start && day.getDate() === start.getDate();
    case "yearly":  return !!start && day >= start && day.getMonth() === start.getMonth() && day.getDate() === start.getDate();
  }
}

function createNextInstance(todo: Todo): Todo | null {
  if (todo.recurrence.type === "none" || !todo.plannedStart) return null;
  const start = parseYMD(todo.plannedStart);
  if (!start) return null;
  const duration = todo.plannedEnd ? parseYMD(todo.plannedEnd)!.getTime() - start.getTime() : 0;
  const ns = new Date(start);
  switch (todo.recurrence.type) {
    case "daily":    ns.setDate(ns.getDate() + 1); break;
    case "weekdays": ns.setDate(ns.getDate() + 1); while (ns.getDay() === 0 || ns.getDay() === 6) ns.setDate(ns.getDate() + 1); break;
    case "weekly":   ns.setDate(ns.getDate() + 7); break;
    case "monthly":  ns.setMonth(ns.getMonth() + 1); break;
    case "yearly":   ns.setFullYear(ns.getFullYear() + 1); break;
  }
  const ne = duration > 0 ? new Date(ns.getTime() + duration) : null;
  return { ...todo, id: "next-id", completed: false, actualStart: "", actualEnd: "", createdAt: Date.now(), plannedStart: toYMD(ns), plannedEnd: ne ? toYMD(ne) : "" };
}

function getCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const last      = new Date(year, month + 1, 0).getDate();
  const days: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= last; d++) {
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

// ─── テスト用ベースタスク ─────────────────────────────────────────────────────

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "test-id", text: "テストタスク", completed: false, createdAt: 0,
    plannedStart: "2026-04-06", plannedEnd: "2026-04-06",
    actualStart: "", actualEnd: "",
    recurrence: { type: "none" },
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// toYMD
// ══════════════════════════════════════════════════════════════════════════════

describe("toYMD", () => {
  it("Dateオブジェクトを YYYY-MM-DD 形式に変換する", () => {
    expect(toYMD(new Date(2026, 3, 3))).toBe("2026-04-03"); // 月は0始まり
    expect(toYMD(new Date(2026, 11, 31))).toBe("2026-12-31");
    expect(toYMD(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// parseYMD
// ══════════════════════════════════════════════════════════════════════════════

describe("parseYMD", () => {
  it("YYYY-MM-DD 文字列を Date に変換する", () => {
    const d = parseYMD("2026-04-03");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(3);   // 0始まり
    expect(d?.getDate()).toBe(3);
  });

  it("空文字を渡すと null を返す", () => {
    expect(parseYMD("")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// formatDisplay
// ══════════════════════════════════════════════════════════════════════════════

describe("formatDisplay", () => {
  it("YYYY-MM-DD を YYYY/M/D 形式に変換する", () => {
    expect(formatDisplay("2026-04-03")).toBe("2026/04/03");
    expect(formatDisplay("2026-12-31")).toBe("2026/12/31");
  });

  it("空文字を渡すと空文字を返す", () => {
    expect(formatDisplay("")).toBe("");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// occursOnDay — 繰り返し設定（T-02 対応）
// ══════════════════════════════════════════════════════════════════════════════

describe("occursOnDay — 繰り返しなし（T-02-01）", () => {
  const todo = makeTodo({ plannedStart: "2026-04-10", plannedEnd: "2026-04-12" });

  it("期間内の日は true", () => {
    expect(occursOnDay(todo, "2026-04-10")).toBe(true);
    expect(occursOnDay(todo, "2026-04-11")).toBe(true);
    expect(occursOnDay(todo, "2026-04-12")).toBe(true);
  });

  it("期間外の日は false", () => {
    expect(occursOnDay(todo, "2026-04-09")).toBe(false);
    expect(occursOnDay(todo, "2026-04-13")).toBe(false);
  });
});

describe("occursOnDay — 毎日（T-02-02）", () => {
  const todo = makeTodo({ plannedStart: "2026-04-10", plannedEnd: "2026-04-10", recurrence: { type: "daily" } });

  it("開始日以降は true", () => {
    expect(occursOnDay(todo, "2026-04-10")).toBe(true);
    expect(occursOnDay(todo, "2026-12-31")).toBe(true);
    expect(occursOnDay(todo, "2027-01-01")).toBe(true);
  });

  it("開始日より前は false", () => {
    expect(occursOnDay(todo, "2026-04-09")).toBe(false);
  });
});

describe("occursOnDay — 平日のみ（T-02-03）", () => {
  // 2026-04-06 は月曜日
  const todo = makeTodo({ plannedStart: "2026-04-06", plannedEnd: "2026-04-06", recurrence: { type: "weekdays" } });

  it("月〜金は true", () => {
    expect(occursOnDay(todo, "2026-04-06")).toBe(true); // 月
    expect(occursOnDay(todo, "2026-04-07")).toBe(true); // 火
    expect(occursOnDay(todo, "2026-04-08")).toBe(true); // 水
    expect(occursOnDay(todo, "2026-04-09")).toBe(true); // 木
    expect(occursOnDay(todo, "2026-04-10")).toBe(true); // 金
  });

  it("土・日は false", () => {
    expect(occursOnDay(todo, "2026-04-11")).toBe(false); // 土
    expect(occursOnDay(todo, "2026-04-12")).toBe(false); // 日
  });
});

describe("occursOnDay — 毎週（T-02-04）", () => {
  // 2026-04-06 は月曜日。月・水を指定
  const todo = makeTodo({
    plannedStart: "2026-04-06",
    plannedEnd: "2026-04-06",
    recurrence: { type: "weekly", weekDays: [1, 3] }, // 月=1, 水=3
  });

  it("指定曜日（月・水）は true", () => {
    expect(occursOnDay(todo, "2026-04-06")).toBe(true); // 月
    expect(occursOnDay(todo, "2026-04-08")).toBe(true); // 水
    expect(occursOnDay(todo, "2026-04-13")).toBe(true); // 翌週月
  });

  it("指定外の曜日は false", () => {
    expect(occursOnDay(todo, "2026-04-07")).toBe(false); // 火
    expect(occursOnDay(todo, "2026-04-09")).toBe(false); // 木
    expect(occursOnDay(todo, "2026-04-11")).toBe(false); // 土
  });
});

describe("occursOnDay — 毎月（T-02-05）", () => {
  // 4月3日開始
  const todo = makeTodo({ plannedStart: "2026-04-03", plannedEnd: "2026-04-03", recurrence: { type: "monthly" } });

  it("毎月3日は true", () => {
    expect(occursOnDay(todo, "2026-04-03")).toBe(true);
    expect(occursOnDay(todo, "2026-05-03")).toBe(true);
    expect(occursOnDay(todo, "2027-01-03")).toBe(true);
  });

  it("3日以外は false", () => {
    expect(occursOnDay(todo, "2026-04-04")).toBe(false);
    expect(occursOnDay(todo, "2026-05-02")).toBe(false);
  });

  it("開始日より前の同日は false", () => {
    expect(occursOnDay(todo, "2026-03-03")).toBe(false);
  });
});

describe("occursOnDay — 毎年（T-02-06）", () => {
  // 4月3日開始
  const todo = makeTodo({ plannedStart: "2026-04-03", plannedEnd: "2026-04-03", recurrence: { type: "yearly" } });

  it("毎年4月3日は true", () => {
    expect(occursOnDay(todo, "2026-04-03")).toBe(true);
    expect(occursOnDay(todo, "2027-04-03")).toBe(true);
    expect(occursOnDay(todo, "2030-04-03")).toBe(true);
  });

  it("4月3日以外は false", () => {
    expect(occursOnDay(todo, "2026-04-04")).toBe(false);
    expect(occursOnDay(todo, "2027-05-03")).toBe(false);
  });
});

describe("occursOnDay — 完了済み繰り返しタスク", () => {
  // 完了した繰り返しタスクは plannedStart〜plannedEnd の期間のみ表示
  const todo = makeTodo({
    plannedStart: "2026-04-06",
    plannedEnd: "2026-04-06",
    completed: true,
    recurrence: { type: "weekly" },
  });

  it("完了したインスタンスの予定期間内は true", () => {
    expect(occursOnDay(todo, "2026-04-06")).toBe(true);
  });

  it("完了したインスタンスの予定期間外は false（繰り返しパターンを無視）", () => {
    expect(occursOnDay(todo, "2026-04-13")).toBe(false); // 翌週同曜日
    expect(occursOnDay(todo, "2026-04-20")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// createNextInstance — 次インスタンス生成（T-02-07 対応）
// ══════════════════════════════════════════════════════════════════════════════

describe("createNextInstance", () => {
  it("繰り返しなしは null を返す", () => {
    const todo = makeTodo({ recurrence: { type: "none" } });
    expect(createNextInstance(todo)).toBeNull();
  });

  it("毎日: 翌日の開始日を生成する", () => {
    const todo = makeTodo({ plannedStart: "2026-04-10", plannedEnd: "2026-04-10", recurrence: { type: "daily" } });
    const next = createNextInstance(todo);
    expect(next?.plannedStart).toBe("2026-04-11");
    expect(next?.completed).toBe(false);
    expect(next?.actualStart).toBe("");
  });

  it("平日のみ: 金曜日の翌営業日（月曜日）を生成する", () => {
    // 2026-04-10 は金曜日
    const todo = makeTodo({ plannedStart: "2026-04-10", plannedEnd: "2026-04-10", recurrence: { type: "weekdays" } });
    const next = createNextInstance(todo);
    expect(next?.plannedStart).toBe("2026-04-13"); // 月曜日
  });

  it("毎週: 7日後の開始日を生成する", () => {
    const todo = makeTodo({ plannedStart: "2026-04-06", plannedEnd: "2026-04-06", recurrence: { type: "weekly" } });
    const next = createNextInstance(todo);
    expect(next?.plannedStart).toBe("2026-04-13");
  });

  it("毎月: 翌月同日を生成する", () => {
    const todo = makeTodo({ plannedStart: "2026-04-03", plannedEnd: "2026-04-03", recurrence: { type: "monthly" } });
    const next = createNextInstance(todo);
    expect(next?.plannedStart).toBe("2026-05-03");
  });

  it("毎年: 翌年同月日を生成する", () => {
    const todo = makeTodo({ plannedStart: "2026-04-03", plannedEnd: "2026-04-03", recurrence: { type: "yearly" } });
    const next = createNextInstance(todo);
    expect(next?.plannedStart).toBe("2027-04-03");
  });

  it("期間がある場合、元の日数を維持する", () => {
    // 開始:4/1 終了:4/3 → 2日間。次: 開始:4/2 終了:4/4（毎日）
    const todo = makeTodo({ plannedStart: "2026-04-01", plannedEnd: "2026-04-03", recurrence: { type: "daily" } });
    const next = createNextInstance(todo);
    expect(next?.plannedStart).toBe("2026-04-02");
    expect(next?.plannedEnd).toBe("2026-04-04");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getCalendarDays
// ══════════════════════════════════════════════════════════════════════════════

describe("getCalendarDays", () => {
  it("2026年4月（水曜始まり）の日付配列を生成する", () => {
    const days = getCalendarDays(2026, 3); // 3 = 4月（0始まり）
    // 2026-04-01 は水曜(3)なので先頭に null が3つ
    expect(days[0]).toBeNull();
    expect(days[1]).toBeNull();
    expect(days[2]).toBeNull();
    expect(days[3]).toBe("2026-04-01");
    expect(days[days.length - 1]).toBe("2026-04-30");
  });

  it("2026年1月（木曜始まり）の配列長が正しい", () => {
    const days = getCalendarDays(2026, 0); // 0 = 1月
    // 1月は31日 + 先頭の空セル(木=4)
    expect(days.filter(Boolean).length).toBe(31);
  });

  it("うるう年の2月は29日分を生成する", () => {
    const days = getCalendarDays(2024, 1); // 2024年2月（うるう年）
    expect(days.filter(Boolean).length).toBe(29);
  });
});
