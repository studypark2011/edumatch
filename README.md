# 教育特化型RAG対話メディア（研究用アプリ）

論文「AIとの対話を通じた教育関係者の意見言語化支援 ― 教育特化型RAGと対話モードを備えた対話型メディアの設計と予備的評価 ―」（AsiaEdu 2026 予備調査）のために実装した Web アプリです。

教育関係者が AI との対話を通じて **自分の意見を形成・言語化** することを支援します。AI を「答えを与える存在」ではなく **思考の足場（scaffolding）** として位置づけています。

## 主な機能

1. **教育特化型RAG**（論文 3.2 / 図1）— 学習指導要領・文科省ガイドライン・生徒指導提要などの公的文書を登録し、`pgvector` で検索して根拠ある応答を生成。
2. **3つの対話モード**（論文 3.3 / 図3）— ナビゲーター / ディスカッション / ディベート。システムプロンプトで振る舞いを規定し、管理画面から編集可能。
3. **対話 → 意見表明の導線**（論文 3.4 / 図5）— 対話が深まると投稿を促し、AI 下書き支援つきで意見を公開ボードへ。
4. **研究用 A/B 制御** — 群X/Y × テーマで「モードA/B＝RAGあり/なし」を出し分け（カウンターバランス）。回答者には RAG の有無を見せない（盲検）。対話ログを Supabase に保存し CSV 出力。

Google フォーム（事前・事後アンケート）の「対話パート」を担うアプリです。

## 技術構成

- **Next.js 16**（App Router）+ TypeScript + Tailwind CSS → Vercel デプロイ
- **Supabase**（Postgres + `pgvector` / RLS）
- **Anthropic Claude**（対話・ストリーミング）
- 埋め込み: **OpenAI** `text-embedding-3-small@1024` または **Voyage** `voyage-3.5-lite`（次元1024で統一）

---

## セットアップ

### 1. Supabase プロジェクト作成

1. <https://supabase.com> でプロジェクトを作成。
2. **SQL Editor** で以下を順に実行：
   - `supabase/migrations/0001_init.sql`（テーブル・pgvector・検索RPC・RLS）
   - `supabase/seed.sql`（テーマ2件・対話モード3件・実験設定4行）
3. **Settings > API** から `Project URL` / `anon key` / `service_role key` を控える。

> CLI を使う場合：`npx supabase link` 後 `npx supabase db push`、`npx supabase db execute --file supabase/seed.sql`。

### 2. 環境変数

`.env.example` を `.env.local` にコピーして値を設定：

```bash
cp .env.example .env.local
```

- `SUPABASE_SERVICE_ROLE_KEY` … サーバ専用。**公開禁止**。
- `ANTHROPIC_API_KEY` … 対話用。
- `EMBEDDING_PROVIDER` … `openai`（要 `OPENAI_API_KEY`）または `voyage`（要 `VOYAGE_API_KEY`）。
- `ADMIN_PASSWORD` … `/admin` ログイン用。

### 3. ローカル起動

```bash
npm install
npm run dev
```

<http://localhost:3000> を開く。

### 4. 文書の登録（RAG）

1. `/admin/login` で `ADMIN_PASSWORD` を入力。
2. **文書管理** で公的文書を登録（URL から PDF/HTML 取得、またはテキスト貼り付け）。
   - テーマ1: 文科省 生成AI利用ガイドライン、各校種の学習指導要領 など → タグ `theme1`
   - テーマ2: 生徒指導提要、校則見直しに関する通知 など → タグ `theme2`
   - 登録すると自動でチャンク化・埋め込み生成され、状態が「✅ 利用可」になります。

### 5. デプロイ（Vercel）

1. リポジトリを GitHub に push。
2. Vercel でインポートし、`.env.local` と同じ環境変数を設定。
3. デプロイ。Google フォームの「別タブでAIツールを開く」リンクに本番URLを貼る。

> 大きな PDF の取り込みは埋め込み生成に時間がかかります。Vercel の関数タイムアウト（Hobby は60秒）に収まらない場合は、テキスト分割登録か Pro プランをご検討ください。

---

## 研究フロー（A/B デザイン）

| 群 | テーマ1（生成AIの年齢） | テーマ2（校則と生徒の意見反映） |
|----|----------------------|------------------------------|
| 群X | モードA = RAGあり | モードB = RAGなし |
| 群Y | モードA = RAGなし | モードB = RAGあり |

- 回答者は `/`（トップ）でグループを選び、フォームで指定されたテーマの対話を開始。
- アプリは `experiment_config` から条件（表示モード・対話スタイル・RAG有無）を解決。**RAG有無はクライアントに返さない**。
- 集計: 管理ダッシュボードの **メッセージCSV**（群・テーマ・RAG有無の列付き）を使用。
  - 「RAGあり」= 群Xのテーマ1 + 群Yのテーマ2
  - 「RAGなし」= 群Xのテーマ2 + 群Yのテーマ1

実験条件は `/admin/experiment` から変更できます。

---

## ディレクトリ

```
supabase/
  migrations/0001_init.sql   # スキーマ・pgvector・RPC・RLS
  seed.sql                   # テーマ/モード/実験設定の初期データ
src/
  lib/                       # env, supabase, anthropic, embeddings, rag, experiment, admin
  app/
    page.tsx                 # 参加者トップ（群選択・テーマ選択）
    dialogue/                # 対話画面
    board/                   # 公開意見ボード
    admin/                   # 管理（文書/モード/実験設定/CSV）
    api/                     # session, chat(ストリーミング), draft, post, admin/*
  components/                # UI（EntryForm, DialogueClient, admin/*）
```

## 注意（研究倫理・プライバシー）

- 氏名・メールアドレスなど個人を特定する情報は収集しません（匿名）。
- 対話ログは研究目的にのみ使用してください。
- `service_role key` と `ADMIN_PASSWORD` は厳重に管理してください。
