"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecurrenceType = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

type Recurrence = {
  type: RecurrenceType;
  weekDays?: number[]; // 0=日 … 6=土（weekly のみ使用）
};

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  recurrence: Recurrence;
};

type Filter = "all" | "active" | "completed";
type View   = "list" | "calendar";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const RECURRENCE_OPTIONS: { type: RecurrenceType; label: string }[] = [
  { type: "none",     label: "なし" },
  { type: "daily",    label: "毎日" },
  { type: "weekdays", label: "平日のみ" },
  { type: "weekly",   label: "毎週" },
  { type: "monthly",  label: "毎月" },
  { type: "yearly",   label: "毎年" },
];

const DATE_FIELDS: {
  key: keyof Pick<Todo, "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd">;
  label: string;
}[] = [
  { key: "plannedStart", label: "開始予定日" },
  { key: "plannedEnd",   label: "終了予定日" },
  { key: "actualStart",  label: "開始実績" },
  { key: "actualEnd",    label: "終了実績" },
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────

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

/** タスクが指定日に表示されるか（繰り返し対応） */
function occursOnDay(todo: Todo, dayStr: string): boolean {
  const day = parseYMD(dayStr);
  if (!day) return false;

  // 完了した繰り返しタスクは、そのインスタンスの予定期間のみ表示
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
      if (!todo.plannedStart && !todo.plannedEnd) return false;
      const s = todo.plannedStart ? parseYMD(todo.plannedStart) : null;
      const e = todo.plannedEnd   ? parseYMD(todo.plannedEnd)   : null;
      if (s && e) return day >= s && day <= e;
      if (s) return dayStr === todo.plannedStart;
      if (e) return dayStr === todo.plannedEnd;
      return false;
    }
    case "daily":
      return !!start && day >= start;
    case "weekdays": {
      const w = day.getDay();
      return !!start && day >= start && w >= 1 && w <= 5;
    }
    case "weekly": {
      if (!start) return false;
      const weekDays = todo.recurrence.weekDays?.length
        ? todo.recurrence.weekDays
        : [start.getDay()];
      return day >= start && weekDays.includes(day.getDay());
    }
    case "monthly":
      return !!start && day >= start && day.getDate() === start.getDate();
    case "yearly":
      return !!start && day >= start &&
        day.getMonth() === start.getMonth() && day.getDate() === start.getDate();
  }
}

/** 繰り返しタスクの次インスタンスを生成 */
function createNextInstance(todo: Todo): Todo | null {
  if (todo.recurrence.type === "none" || !todo.plannedStart) return null;
  const start = parseYMD(todo.plannedStart);
  if (!start) return null;

  const duration = todo.plannedEnd
    ? parseYMD(todo.plannedEnd)!.getTime() - start.getTime()
    : 0;

  const ns = new Date(start);
  switch (todo.recurrence.type) {
    case "daily":   ns.setDate(ns.getDate() + 1); break;
    case "weekdays":
      ns.setDate(ns.getDate() + 1);
      while (ns.getDay() === 0 || ns.getDay() === 6) ns.setDate(ns.getDate() + 1);
      break;
    case "weekly":  ns.setDate(ns.getDate() + 7); break;
    case "monthly": ns.setMonth(ns.getMonth() + 1); break;
    case "yearly":  ns.setFullYear(ns.getFullYear() + 1); break;
  }
  const ne = duration > 0 ? new Date(ns.getTime() + duration) : null;

  return {
    ...todo,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    completed: false,
    actualStart: "",
    actualEnd: "",
    createdAt: Date.now(),
    plannedStart: toYMD(ns),
    plannedEnd: ne ? toYMD(ne) : "",
  };
}

/** カレンダー用：月の日付文字列配列（null = 空セル） */
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

/** 繰り返し種別のラベル */
function recurrenceLabel(r: Recurrence): string {
  if (r.type === "none") return "";
  if (r.type === "weekdays") return "平日のみ";
  if (r.type === "weekly") {
    const days = r.weekDays?.length
      ? r.weekDays.map((d) => DAY_LABELS[d]).join("・")
      : "毎週";
    return `毎週(${days})`;
  }
  return RECURRENCE_OPTIONS.find((o) => o.type === r.type)?.label ?? "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const today = toYMD(new Date());

  // Core
  const [todos,   setTodos]   = useState<Todo[]>([]);
  const [mounted, setMounted] = useState(false);

  // Add form
  const [input,           setInput]           = useState("");
  const [addPlannedStart, setAddPlannedStart] = useState("");
  const [addPlannedEnd,   setAddPlannedEnd]   = useState("");
  const [addRecurrence,   setAddRecurrence]   = useState<Recurrence>({ type: "none" });
  const [formErrors,      setFormErrors]      = useState<{ text?: boolean; plannedStart?: boolean; plannedEnd?: boolean }>({});

  // List
  const [filter,      setFilter]      = useState<Filter>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editDates,   setEditDates]   = useState<Record<string, Partial<Todo>>>({});

  // Completion
  const [completingId,      setCompletingId]      = useState<string | null>(null);
  const [completionDates,   setCompletionDates]   = useState({ actualStart: "", actualEnd: "" });
  const [completionErrors,  setCompletionErrors]  = useState({ actualStart: false, actualEnd: false });

  // Calendar
  const [view,        setView]        = useState<View>("list");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calYear,     setCalYear]     = useState(new Date().getFullYear());
  const [calMonth,    setCalMonth]    = useState(new Date().getMonth());

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Persistence ──────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("todos-v2");
    if (saved) {
      const loaded: Todo[] = JSON.parse(saved);
      // 旧データに recurrence がなければ補完
      setTodos(loaded.map((t) => ({ ...t, recurrence: t.recurrence ?? { type: "none" } })));
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("todos-v2", JSON.stringify(todos));
  }, [todos, mounted]);

  // ── Add ──────────────────────────────────────────────────────────────────

  const addTodo = () => {
    const text = input.trim();
    const errors = { text: !text, plannedStart: !addPlannedStart, plannedEnd: !addPlannedEnd };
    if (errors.text || errors.plannedStart || errors.plannedEnd) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setTodos((prev) => [
      ...prev,
      {
        id, text, completed: false, createdAt: Date.now(),
        plannedStart: addPlannedStart, plannedEnd: addPlannedEnd,
        actualStart: "", actualEnd: "",
        recurrence: addRecurrence,
      },
    ]);
    setInput("");
    setAddPlannedStart("");
    setAddPlannedEnd("");
    setAddRecurrence({ type: "none" });
    inputRef.current?.focus();
  };

  // ── Completion ────────────────────────────────────────────────────────────

  const startCompletion = (id: string) => {
    setCompletingId(id);
    setCompletionDates({ actualStart: today, actualEnd: today });
    setCompletionErrors({ actualStart: false, actualEnd: false });
    // 展開パネルを閉じる
    setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const confirmCompletion = (id: string) => {
    const errors = { actualStart: !completionDates.actualStart, actualEnd: !completionDates.actualEnd };
    if (errors.actualStart || errors.actualEnd) { setCompletionErrors(errors); return; }

    const todo = todos.find((t) => t.id === id);
    const next = todo?.recurrence.type !== "none" ? createNextInstance(todo!) : null;

    setTodos((prev) => {
      const updated = prev.map((t) =>
        t.id === id
          ? { ...t, completed: true, actualStart: completionDates.actualStart, actualEnd: completionDates.actualEnd }
          : t
      );
      return next ? [...updated, next] : updated;
    });
    setCompletingId(null);
  };

  const cancelCompletion = () => {
    setCompletingId(null);
    setCompletionErrors({ actualStart: false, actualEnd: false });
  };

  const uncomplete = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => t.id === id ? { ...t, completed: false, actualStart: "", actualEnd: "" } : t)
    );
  };

  // ── Other operations ──────────────────────────────────────────────────────

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (completingId === id) setCompletingId(null);
  };

  const clearCompleted = () => setTodos((prev) => prev.filter((t) => !t.completed));

  const toggleExpand = (id: string) => {
    const isOpen = expandedIds.has(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      isOpen ? next.delete(id) : next.add(id);
      return next;
    });
    if (!isOpen) {
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        setEditDates((prev) => ({
          ...prev,
          [id]: {
            plannedStart: todo.plannedStart, plannedEnd: todo.plannedEnd,
            actualStart:  todo.actualStart,  actualEnd:  todo.actualEnd,
          },
        }));
      }
      if (completingId === id) setCompletingId(null);
    }
  };

  const saveDates = (id: string) => {
    const dates = editDates[id];
    if (!dates) return;
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, ...dates } : t));
    toggleExpand(id);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredTodos    = todos.filter((t) => filter === "active" ? !t.completed : filter === "completed" ? t.completed : true);
  const activeCount      = todos.filter((t) => !t.completed).length;
  const completedCount   = todos.filter((t) =>  t.completed).length;

  // Calendar
  const calDays          = getCalendarDays(calYear, calMonth);
  const getTodosForDay   = (d: string) => todos.filter((t) => occursOnDay(t, d));
  const prevMonth        = () => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); };
  const nextMonth        = () => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); };
  const selectedDayTodos = selectedDay ? getTodosForDay(selectedDay) : [];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-stone-100 flex items-start justify-center pt-12 px-4 pb-16">
      <div className="w-full max-w-2xl">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-700">ToDoリスト</h1>
          <p className="text-stone-400 text-sm mt-1">タスクを管理してください</p>
        </div>

        {/* ── View Tabs ── */}
        <div className="flex gap-1 mb-6 bg-stone-200 rounded-xl p-1 w-fit">
          {(["list", "calendar"] as View[]).map((key) => (
            <button key={key} onClick={() => setView(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === key ? "bg-white text-stone-700 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}>
              {key === "list" ? "リスト" : "カレンダー"}
            </button>
          ))}
        </div>

        {/* ══════════════ LIST VIEW ══════════════ */}
        {view === "list" && (
          <>
            {/* ── Add Form ── */}
            <form onSubmit={(e) => { e.preventDefault(); addTodo(); }}
              className="bg-white rounded-2xl border border-stone-200 p-4 mb-5">

              {/* タスク名 */}
              <div className="flex gap-2 mb-1">
                <input ref={inputRef} type="text" value={input}
                  onChange={(e) => { setInput(e.target.value); setFormErrors((p) => ({ ...p, text: false })); }}
                  placeholder="新しいタスクを入力..."
                  className={`flex-1 px-4 py-2.5 rounded-xl bg-stone-50 border text-stone-700 placeholder-stone-300 outline-none transition-colors text-sm ${
                    formErrors.text ? "border-red-300 focus:border-red-400" : "border-stone-200 focus:border-stone-400"
                  }`}
                />
                <button type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-600 text-white text-sm font-medium hover:bg-stone-700 active:bg-stone-800 transition-colors">
                  追加
                </button>
              </div>
              {formErrors.text && <p className="text-xs text-red-400 mb-2">タスク名を入力してください</p>}

              {/* 予定日 */}
              <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
                <div>
                  <label className={`block text-xs mb-1 ${formErrors.plannedStart ? "text-red-400" : "text-stone-400"}`}>
                    開始予定日 <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={addPlannedStart}
                    onChange={(e) => { setAddPlannedStart(e.target.value); setFormErrors((p) => ({ ...p, plannedStart: false })); }}
                    className={`w-full px-3 py-2 rounded-lg bg-stone-50 border text-stone-600 text-xs outline-none transition-colors ${
                      formErrors.plannedStart ? "border-red-300 focus:border-red-400" : "border-stone-200 focus:border-stone-400"
                    }`}
                  />
                  {formErrors.plannedStart && <p className="text-xs text-red-400 mt-1">選択してください</p>}
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${formErrors.plannedEnd ? "text-red-400" : "text-stone-400"}`}>
                    終了予定日 <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={addPlannedEnd}
                    onChange={(e) => { setAddPlannedEnd(e.target.value); setFormErrors((p) => ({ ...p, plannedEnd: false })); }}
                    className={`w-full px-3 py-2 rounded-lg bg-stone-50 border text-stone-600 text-xs outline-none transition-colors ${
                      formErrors.plannedEnd ? "border-red-300 focus:border-red-400" : "border-stone-200 focus:border-stone-400"
                    }`}
                  />
                  {formErrors.plannedEnd && <p className="text-xs text-red-400 mt-1">選択してください</p>}
                </div>
              </div>

              {/* 繰り返し */}
              <div className="border-t border-stone-100 pt-3">
                <label className="block text-xs text-stone-400 mb-2">繰り返し</label>
                <div className="flex gap-1 flex-wrap">
                  {RECURRENCE_OPTIONS.map(({ type, label }) => (
                    <button type="button" key={type}
                      onClick={() => setAddRecurrence({ type, weekDays: type === "weekly" ? [] : undefined })}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        addRecurrence.type === type
                          ? "bg-stone-600 text-white"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {addRecurrence.type === "weekly" && (
                  <div className="flex gap-1 mt-2">
                    {DAY_LABELS.map((d, i) => {
                      const sel = (addRecurrence.weekDays ?? []).includes(i);
                      return (
                        <button type="button" key={d}
                          onClick={() => {
                            const days = addRecurrence.weekDays ?? [];
                            setAddRecurrence({
                              ...addRecurrence,
                              weekDays: sel ? days.filter((x) => x !== i) : [...days, i],
                            });
                          }}
                          className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                            sel ? "bg-stone-600 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                          }`}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </form>

            {/* ── Filters ── */}
            {todos.length > 0 && (
              <div className="flex gap-1 mb-4">
                {(["all", "active", "completed"] as Filter[]).map((key) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filter === key ? "bg-stone-600 text-white" : "bg-white text-stone-500 hover:bg-stone-200 border border-stone-200"
                    }`}>
                    {key === "all" ? "すべて" : key === "active" ? "未完了" : "完了済み"}
                  </button>
                ))}
              </div>
            )}

            {/* ── Task List ── */}
            <div className="space-y-2">
              {mounted && filteredTodos.length === 0 && (
                <div className="text-center py-12 text-stone-400 text-sm">
                  {filter === "completed" ? "完了済みのタスクはありません"
                    : filter === "active" ? "未完了のタスクはありません"
                    : "タスクを追加してください"}
                </div>
              )}

              {filteredTodos.map((todo) => {
                const expanded     = expandedIds.has(todo.id);
                const isCompleting = completingId === todo.id;
                const dates        = editDates[todo.id] ?? todo;
                const isOverdue    = !todo.completed && !!todo.plannedEnd && todo.plannedEnd < today && todo.recurrence.type === "none";
                const rLabel       = recurrenceLabel(todo.recurrence);

                return (
                  <div key={todo.id} className={`rounded-xl bg-white border transition-all ${
                    todo.completed  ? "border-stone-100 opacity-60"
                    : isCompleting  ? "border-indigo-200"
                    : isOverdue     ? "border-red-200"
                    : "border-stone-200"
                  }`}>

                    {/* Task Row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Complete Button */}
                      <button
                        onClick={() => todo.completed ? uncomplete(todo.id) : startCompletion(todo.id)}
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          todo.completed  ? "bg-stone-400 border-stone-400"
                          : isCompleting  ? "border-indigo-400 bg-indigo-50"
                          : "border-stone-300 hover:border-stone-500"
                        }`}
                        aria-label={todo.completed ? "未完了に戻す" : "完了にする"}>
                        {todo.completed && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Text + badges */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${todo.completed ? "line-through text-stone-400" : "text-stone-700"}`}>
                          {todo.text}
                        </p>
                        <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                          {(todo.plannedStart || todo.plannedEnd) && (
                            <span className={`text-xs ${isOverdue ? "text-red-400" : "text-stone-400"}`}>
                              {formatDisplay(todo.plannedStart)}{todo.plannedEnd ? ` 〜 ${formatDisplay(todo.plannedEnd)}` : ""}
                            </span>
                          )}
                          {rLabel && (
                            <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{rLabel}</span>
                          )}
                        </div>
                      </div>

                      {/* Expand */}
                      <button onClick={() => toggleExpand(todo.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 hover:text-stone-500 hover:bg-stone-50 transition-colors flex-shrink-0"
                        aria-label="詳細">
                        <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button onClick={() => deleteTodo(todo.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                        aria-label="削除">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* ── Completion Panel ── */}
                    {isCompleting && (
                      <div className="px-4 pb-4 border-t border-indigo-100 bg-indigo-50/40">
                        <p className="text-xs text-indigo-600 font-medium mt-3 mb-2">
                          実績日を入力して完了してください
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`block text-xs mb-1 ${completionErrors.actualStart ? "text-red-400" : "text-stone-500"}`}>
                              開始実績 <span className="text-red-400">*</span>
                            </label>
                            <input type="date" value={completionDates.actualStart}
                              onChange={(e) => {
                                setCompletionDates((p) => ({ ...p, actualStart: e.target.value }));
                                setCompletionErrors((p) => ({ ...p, actualStart: false }));
                              }}
                              className={`w-full px-3 py-2 rounded-lg bg-white border text-stone-600 text-xs outline-none transition-colors ${
                                completionErrors.actualStart ? "border-red-300" : "border-stone-200 focus:border-indigo-300"
                              }`}
                            />
                            {completionErrors.actualStart && <p className="text-xs text-red-400 mt-0.5">入力してください</p>}
                          </div>
                          <div>
                            <label className={`block text-xs mb-1 ${completionErrors.actualEnd ? "text-red-400" : "text-stone-500"}`}>
                              終了実績 <span className="text-red-400">*</span>
                            </label>
                            <input type="date" value={completionDates.actualEnd}
                              onChange={(e) => {
                                setCompletionDates((p) => ({ ...p, actualEnd: e.target.value }));
                                setCompletionErrors((p) => ({ ...p, actualEnd: false }));
                              }}
                              className={`w-full px-3 py-2 rounded-lg bg-white border text-stone-600 text-xs outline-none transition-colors ${
                                completionErrors.actualEnd ? "border-red-300" : "border-stone-200 focus:border-indigo-300"
                              }`}
                            />
                            {completionErrors.actualEnd && <p className="text-xs text-red-400 mt-0.5">入力してください</p>}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => confirmCompletion(todo.id)}
                            className="flex-1 py-2 rounded-lg bg-stone-600 text-white text-xs font-medium hover:bg-stone-700 transition-colors">
                            完了する
                          </button>
                          <button onClick={cancelCompletion}
                            className="px-4 py-2 rounded-lg bg-white border border-stone-200 text-stone-500 text-xs font-medium hover:bg-stone-50 transition-colors">
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Date Edit Panel ── */}
                    {expanded && (
                      <div className="px-4 pb-4 border-t border-stone-100">
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {DATE_FIELDS.map(({ key, label }) => (
                            <div key={key}>
                              <label className="block text-xs text-stone-400 mb-1">{label}</label>
                              <input type="date"
                                value={(dates[key] as string) ?? ""}
                                onChange={(e) =>
                                  setEditDates((prev) => ({
                                    ...prev,
                                    [todo.id]: { ...(prev[todo.id] ?? todo), [key]: e.target.value },
                                  }))
                                }
                                className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-stone-600 text-xs outline-none focus:border-stone-400 transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                        <button onClick={() => saveDates(todo.id)}
                          className="mt-3 w-full py-2 rounded-lg bg-stone-600 text-white text-xs font-medium hover:bg-stone-700 transition-colors">
                          保存
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Footer ── */}
            {todos.length > 0 && (
              <div className="flex items-center justify-between mt-6 px-1">
                <span className="text-xs text-stone-400">
                  残り <span className="font-medium text-stone-500">{activeCount}</span> 件
                </span>
                {completedCount > 0 && (
                  <button onClick={clearCompleted}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    完了済みを削除 ({completedCount})
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════ CALENDAR VIEW ══════════════ */}
        {view === "calendar" && (
          <div>
            {/* Month Nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth}
                className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-base font-semibold text-stone-700">{calYear}年 {MONTH_NAMES[calMonth]}</span>
              <button onClick={nextMonth}
                className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Legend */}
            <div className="flex gap-3 mb-3 px-1">
              {[
                { bg: "bg-indigo-100", label: "未完了" },
                { bg: "bg-stone-100",  label: "完了済み" },
                { bg: "bg-red-100",    label: "期限超過" },
              ].map(({ bg, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${bg}`} />
                  <span className="text-xs text-stone-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-stone-100">
                {DAY_LABELS.map((d, i) => (
                  <div key={d} className={`py-2 text-center text-xs font-medium ${
                    i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-stone-400"
                  }`}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calDays.map((dayStr, idx) => {
                  if (!dayStr) return (
                    <div key={`e-${idx}`} className="min-h-[80px] border-b border-r border-stone-50 bg-stone-50/50" />
                  );

                  const dayTodos  = getTodosForDay(dayStr);
                  const isToday   = dayStr === today;
                  const isSel     = dayStr === selectedDay;
                  const dayNum    = parseInt(dayStr.split("-")[2]);
                  const colIdx    = idx % 7;

                  return (
                    <div key={dayStr}
                      onClick={() => setSelectedDay(isSel ? null : dayStr)}
                      className={`min-h-[80px] p-1.5 border-b border-r border-stone-50 cursor-pointer transition-colors ${
                        isSel ? "bg-stone-100" : "hover:bg-stone-50"
                      }`}>
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1 font-medium ${
                        isToday  ? "bg-stone-700 text-white"
                        : colIdx === 0 ? "text-red-400"
                        : colIdx === 6 ? "text-blue-400"
                        : "text-stone-600"
                      }`}>{dayNum}</div>
                      <div className="space-y-0.5">
                        {dayTodos.slice(0, 2).map((t) => {
                          const overdue = !t.completed && !!t.plannedEnd && t.plannedEnd < today && t.recurrence.type === "none";
                          return (
                            <div key={t.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${
                              t.completed ? "bg-stone-100 text-stone-400"
                              : overdue   ? "bg-red-100 text-red-600"
                              : "bg-indigo-100 text-indigo-700"
                            }`}>{t.text}</div>
                          );
                        })}
                        {dayTodos.length > 2 && (
                          <div className="text-xs text-stone-400 px-1">+{dayTodos.length - 2}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Detail */}
            {selectedDay && (
              <div className="mt-4 bg-white rounded-2xl border border-stone-200 p-4">
                <h2 className="text-sm font-semibold text-stone-600 mb-3">
                  {formatDisplay(selectedDay)} のタスク
                  <span className="ml-2 text-stone-400 font-normal">（{selectedDayTodos.length}件）</span>
                </h2>
                {selectedDayTodos.length === 0 ? (
                  <p className="text-sm text-stone-400">この日のタスクはありません</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayTodos.map((t) => {
                      const overdue = !t.completed && !!t.plannedEnd && t.plannedEnd < today && t.recurrence.type === "none";
                      const rLabel  = recurrenceLabel(t.recurrence);
                      return (
                        <div key={t.id} className="flex items-start gap-3 py-2 border-b border-stone-50 last:border-0">
                          <button onClick={() => t.completed ? uncomplete(t.id) : startCompletion(t.id)}
                            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              t.completed ? "bg-stone-400 border-stone-400" : "border-stone-300 hover:border-stone-500"
                            }`}>
                            {t.completed && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${t.completed ? "line-through text-stone-400" : overdue ? "text-red-600" : "text-stone-700"}`}>
                              {t.text}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 items-center">
                              {t.plannedStart && (
                                <span className="text-xs text-stone-400">
                                  予定: {formatDisplay(t.plannedStart)}{t.plannedEnd ? ` 〜 ${formatDisplay(t.plannedEnd)}` : ""}
                                </span>
                              )}
                              {t.actualStart && (
                                <span className="text-xs text-stone-400">
                                  実績: {formatDisplay(t.actualStart)}{t.actualEnd ? ` 〜 ${formatDisplay(t.actualEnd)}` : ""}
                                </span>
                              )}
                              {rLabel && (
                                <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{rLabel}</span>
                              )}
                            </div>
                          </div>
                          {overdue && <span className="text-xs text-red-400 flex-shrink-0 mt-0.5">期限超過</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
