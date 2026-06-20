# 教育特化型RAG対話メディア（研究用アプリ）

論文「AIとの対話を通じた教育関係者の意見言語化支援 ― 教育特化型RAGと対話モードを備えた対話型メディアの設計と予備的評価 ―」（AsiaEdu 2026）の予備調査で用いる Web アプリです。

**事前・事後アンケートを対話システムに統合し、同意 → 属性 → 各テーマ（事前→対話→事後）→ 自由記述 までを1セッションで完結**します（Googleフォーム不要）。アンケート回答と対話ログが自動的に1参加者へ紐づくため、突合作業が不要です。

AI は「答えを与える存在」ではなく、利用者が自ら考えるための **思考の足場（scaffolding）** として設計しています。

## 主な機能

1. **統合フロー（一方向）** — 同意→属性→T1事前→T1対話→T1事後→T2事前→T2対話→T2事後→自由記述→完了。前に戻れない。
2. **教育特化型RAG** — 公的文書を `pgvector` で検索し、根拠を明示した応答を生成。
3. **A/B制御（盲検）** — 群X/Yを自動交互割当し、群×テーマでRAGあり/なしを出し分け。回答者にRAG有無は見せない。
4. **データ記録・出力** — すべての選択式回答を整数1〜4で保存。群・RAGフラグを必ず記録。管理画面からCSV出力。

## 研究データ設計（重要3点）

- **選択式回答は 1〜4 の整数で保存**（ラベルではなく数値。分析が容易）。
- **群（X/Y）と各テーマのRAGあり/なしフラグ（t1_rag, t2_rag）を必ず記録**（条件識別に必須）。
- **管理者向けCSVエクスポート**：`responses.csv`（1参加者=1行）と `dialogues.csv`（対話ログ）。

群の割り当て（カウンターバランス）：

| 群 | テーマ1（生成AIの年齢） | テーマ2（校則と生徒の意見反映） |
|----|----------------------|------------------------------|
| 群X | RAGあり | RAGなし |
| 群Y | RAGなし | RAGあり |

集計：RAGあり = 群Xテーマ1＋群Yテーマ2／RAGなし = 群Xテーマ2＋群Yテーマ1（`responses.csv` の t1_rag/t2_rag で自動判別可能）。

## 技術構成

- **Next.js 16**（App Router）+ TypeScript + Tailwind CSS → Vercel
- **Supabase**（PostgreSQL + `pgvector` / RLS）
- **Anthropic Claude Sonnet 4.6**（対話・ストリーミング）
- 埋め込み：**OpenAI text-embedding-3-small**（1024次元）。Voyage AI へ切替可

## データモデル（要点）

- `participants` … 1参加者=1セッション=1行。属性・群・t1_rag/t2_rag・各テーマの事前/事後/応答評価/モード回答（整数）・自由記述・時刻を保持。
- `conversations` / `messages` … 対話ログ（participant_id・theme・rag_enabled付き）。
- `themes` / `documents` / `document_chunks`(vector) / `modes` / `experiment_config`。

## セットアップ

### 1. Supabase
1. プロジェクトを作成。
2. SQL Editor で `supabase/migrations/*.sql` を番号順に、続けて `supabase/seed.sql` を実行（または `npm run db:setup`）。
3. Settings から URL / anon / service_role キー、Connection string（URI）を控える。

### 2. 環境変数
`.env.example` を `.env.local` にコピーして設定：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `ADMIN_PASSWORD`。

### 3. 起動 / DB構築
```bash
npm install
npm run db:setup     # 全migration + seed を適用
npm run dev
```

### 4. 文書登録（RAG）
- `/admin/login` → 文書管理から登録（URL/テキスト）。大きなPDFは `node scripts/ingest-pdf.mjs`（`scripts/ingest.config.mjs` で対象指定、マルチタグ対応）。

### 5. デプロイ（Vercel）
- GitHub に push → Vercel でインポート → 環境変数設定 → デプロイ。参加者には本番URLを共有するだけ（フォーム不要）。

## 運用スクリプト

- `npm run db:setup` … マイグレーション＋seed適用
- `node scripts/db-verify.mjs` … テーマ/モード/実験設定の確認
- `node scripts/ingest-pdf.mjs` … ローカルPDFをRAGに取り込み
- `npm run db:reset-data` … 配布直前に会話・回答データを全消去し参加者コードをP001から再開（テーマ/モード/文書は保持）

## CSV出力（管理ダッシュボード）

- **responses.csv**：1参加者=1行。participant_code, group_label, t1_rag, t2_rag, 各テーマの pre/post/resp/mode（整数1〜4）, turn/duration, 自由記述。フラグは 1/0。
- **dialogues.csv**：対話ログ（participant_code, group, theme_slug, rag_enabled, role, content, created_at）。participant_code で responses と紐づく。

> 分析では `completed_at` が空のレコード（中断）は除外する運用を推奨。

## プライバシー・倫理

- 氏名・メールアドレス等のPIIは収集しない（完全匿名）。participant_code は意味を持たない連番。
- 管理画面はパスワード認証。秘密鍵・APIキーは環境変数で管理。

## 仕様書

詳細は [docs/仕様書.md](docs/仕様書.md) を参照（論文の System Design 章向け）。
