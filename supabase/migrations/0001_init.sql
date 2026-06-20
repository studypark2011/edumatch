-- =============================================================
-- 教育特化型RAG対話メディア — 初期スキーマ
-- AsiaEdu 2026 予備調査（RAGあり/なし × 2テーマ A/Bデザイン）対応
-- 埋め込み次元 = 1024 (OpenAI text-embedding-3-small@1024 / Voyage voyage-3.5-lite 両対応)
-- =============================================================

create extension if not exists vector;
create extension if not exists "pgcrypto";

-- ---------- テーマ（お題） ----------
create table if not exists themes (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- 'theme1' | 'theme2'
  title       text not null,
  intro       text not null,                 -- フォームの「お題提示」テキスト
  rag_tag     text not null,                 -- このテーマでRAGが参照する文書タグ
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- RAG知識基盤：文書（図1の一覧） ----------
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_type text not null default 'text',  -- 'url' | 'file' | 'text'
  source_url  text,
  tags        text[] not null default '{}',  -- {theme1},{theme2},{common} 等
  status      text not null default 'pending',-- 'pending'|'processing'|'ready'|'error'
  char_count  int  not null default 0,
  chunk_count int  not null default 0,
  error       text,
  created_at  timestamptz not null default now()
);

-- ---------- RAG知識基盤：チャンク（埋め込み） ----------
create table if not exists document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int  not null,
  content     text not null,
  tags        text[] not null default '{}',  -- documents.tags をコピー（フィルタ用）
  embedding   vector(1024),
  created_at  timestamptz not null default now()
);
create index if not exists document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists document_chunks_tags_idx
  on document_chunks using gin (tags);

-- ---------- 対話モード（システムプロンプト管理：図3） ----------
create table if not exists modes (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,        -- 'navigator'|'discussion'|'debate'
  name          text not null,
  description   text,
  system_prompt text not null,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- 実験設定：群×テーマ → 表示モードA/B・対話モード・RAG有無 ----------
create table if not exists experiment_config (
  id               uuid primary key default gen_random_uuid(),
  theme_slug       text not null references themes(slug) on delete cascade,
  group_label      text not null,            -- 'X'|'Y'
  displayed_mode   text not null,            -- 'A'|'B'（回答者に見える呼称）
  dialogue_mode_key text not null default 'navigator',
  rag_enabled      boolean not null default true,
  unique (theme_slug, group_label)
);

-- ---------- 参加者（匿名・PIIなし） ----------
create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  group_label text,                          -- 'X'|'Y'
  role        text,
  ai_usage    text,
  created_at  timestamptz not null default now()
);

-- ---------- 会話 ----------
create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  participant_id   uuid references participants(id) on delete set null,
  theme_slug       text references themes(slug) on delete set null,
  group_label      text,
  displayed_mode   text,                     -- 'A'|'B'
  dialogue_mode_key text,
  rag_enabled      boolean,
  created_at       timestamptz not null default now()
);

-- ---------- メッセージ ----------
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  role              text not null,           -- 'user'|'assistant'
  content           text not null,
  dialogue_mode_key text,
  citations         jsonb,                   -- [{document_id,title,source_url,chunk_index,snippet,similarity}]
  created_at        timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages(conversation_id);

-- ---------- 意見投稿（対話→表明の導線） ----------
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  theme_slug      text references themes(slug) on delete set null,
  participant_id  uuid references participants(id) on delete set null,
  content         text not null,
  ai_assisted     boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists posts_theme_idx on posts(theme_slug);

-- =============================================================
-- ベクトル検索 RPC
-- =============================================================
create or replace function match_chunks(
  query_embedding vector(1024),
  filter_tag      text default null,
  match_count     int  default 6
) returns table (
  id          uuid,
  document_id uuid,
  content     text,
  chunk_index int,
  similarity  float,
  title       text,
  source_url  text
) language sql stable as $$
  select c.id, c.document_id, c.content, c.chunk_index,
         1 - (c.embedding <=> query_embedding) as similarity,
         d.title, d.source_url
  from document_chunks c
  join documents d on d.id = c.document_id
  where (filter_tag is null or c.tags @> array[filter_tag])
    and d.status = 'ready'
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- =============================================================
-- RLS：サーバ側はservice roleで操作（RLSバイパス）。
-- クライアントから直接読む可能性のあるテーブルのみ public read を許可。
-- =============================================================
alter table themes            enable row level security;
alter table documents         enable row level security;
alter table document_chunks   enable row level security;
alter table modes             enable row level security;
alter table experiment_config enable row level security;
alter table participants      enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;
alter table posts             enable row level security;

-- 公開ボード/UI初期表示用の読み取り（匿名）
drop policy if exists "public read themes" on themes;
create policy "public read themes" on themes for select using (true);

drop policy if exists "public read modes" on modes;
create policy "public read modes" on modes for select using (true);

drop policy if exists "public read posts" on posts;
create policy "public read posts" on posts for select using (true);
