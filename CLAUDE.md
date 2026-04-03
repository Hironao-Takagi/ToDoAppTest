# CLAUDE.md — プロジェクト説明書

このファイルはClaude Codeが自動で読み込むプロジェクト説明書です。
作業開始時にここの内容を参照してください。

---

## プロジェクト概要

**システム名:** ToDoリストアプリケーション  
**目的:** 清掃DXプロジェクトにおける業務タスクを管理するWebアプリ。定期的な清掃作業を繰り返しタスクとして登録し、予定日・実績日を二重管理することで業務進捗を把握する。  
**リポジトリ:** https://github.com/Hironao-Takagi/ToDoAppTest

---

## 技術スタック

| 種別 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Next.js (App Router) | 14.2.5 |
| 言語 | TypeScript | ^5 (strict: true) |
| UIライブラリ | React | ^18 |
| スタイリング | Tailwind CSS | ^3.4.1 |
| データ永続化 | localStorage (`todos-v2` キー) | - |
| デプロイ | Vercel | - |

バックエンド・DBは存在しない。データはすべてクライアントの localStorage に保存される。

---

## ファイル構成

```
testpj/
├── CLAUDE.md               # このファイル（AIへの説明書）
├── src/
│   └── app/
│       ├── page.tsx        # メインコンポーネント（全機能・約807行）
│       ├── layout.tsx      # HTMLルートレイアウト・メタデータ
│       └── globals.css     # Tailwind CSSディレクティブ
├── docs/
│   ├── 基本設計書.md
│   ├── 詳細設計書.md
│   ├── テスト仕様書.md
│   └── 操作マニュアル.md
├── next.config.js          # セキュリティヘッダ設定あり
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**重要:** 現在は `page.tsx` に全機能を実装したシングルファイル構成。
コンポーネント分割は行っていない（設計上の意図）。

---

## データモデル

```typescript
type RecurrenceType = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

type Recurrence = {
  type: RecurrenceType;
  weekDays?: number[]; // 0=日曜〜6=土曜（weeklyのみ使用）
};

type Todo = {
  id: string;           // `${Date.now()}-${Math.random().toString(36).slice(2)}`
  text: string;         // タスク名
  completed: boolean;
  createdAt: number;    // Unix timestamp (ms)
  plannedStart: string; // YYYY-MM-DD
  plannedEnd: string;   // YYYY-MM-DD
  actualStart: string;  // YYYY-MM-DD（未入力時は空文字）
  actualEnd: string;    // YYYY-MM-DD（未入力時は空文字）
  recurrence: Recurrence;
};

type Filter = "all" | "active" | "completed";
type View   = "list" | "calendar";
```

日付の内部形式は `YYYY-MM-DD`、画面表示は `YYYY/M/D`。

---

## 主要機能

| 機能ID | 機能名 | 概要 |
|--------|--------|------|
| F-01 | タスク追加 | タスク名・開始予定日・終了予定日・繰り返し設定を入力して登録 |
| F-03 | タスク完了 | 完了時に開始実績日・終了実績日を入力してから完了処理 |
| F-04 | 日付編集 | 追加後に4つの日付フィールドを編集・保存 |
| F-05 | タスク削除 | 個別削除 / 完了済み一括削除 |
| F-07 | フィルタリング | すべて / 未完了 / 完了済みで絞り込み |
| F-08 | カレンダー表示 | 月間カレンダーでタスク期間を可視化 |
| F-09 | 繰り返し設定 | なし / 毎日 / 平日のみ / 毎週 / 毎月 / 毎年 |
| F-10 | 期限超過表示 | 一回限りタスクの期限超過を赤色で強調（繰り返しタスクは対象外） |

---

## コーディング規約

- **言語:** TypeScript（strict モード必須）
- **スタイル:** Tailwind CSSのユーティリティクラスを使用。インラインスタイルは使わない
- **コメント:** 日本語で記述してよい
- **型:** 既存の型定義（Todo, Recurrence 等）を必ず使用する
- **状態管理:** useState を使用。外部状態管理ライブラリは未導入
- **命名規則:** 関数名はキャメルケース（既存コードに合わせる）
- **SSR対策:** `mounted` フラグによるハイドレーション制御を維持する

---

## やってはいけないこと

- `dangerouslySetInnerHTML` を使用しない（XSS対策）
- `.env` ファイルや APIキーをコードに直書きしない
- `page.tsx` 以外の場所に機能コンポーネントを新規作成しない（指示がない限り）
- localStorage への直接書き込みを `mounted === true` 確認なしで行わない
- `next.config.js` のセキュリティヘッダを削除・変更しない

---

## 開発コマンド

```bash
npm run dev    # 開発サーバー起動（localhost:3000）
npm run build  # 本番ビルド
npm run lint   # ESLint実行
```

---

## デプロイ

mainブランチへのpushでVercelが自動デプロイ。  
ビルドコマンド: `next build` / 出力: `.next`

---

## 参考ドキュメント

詳細な仕様は以下を参照：
- [基本設計書](docs/基本設計書.md)
- [詳細設計書](docs/詳細設計書.md)
- [テスト仕様書](docs/テスト仕様書.md)
- [操作マニュアル](docs/操作マニュアル.md)
