-- =============================================================
-- アンケート統合：participants を「1参加者=1セッション=1行」に拡張
-- 選択式回答はすべて int（1〜4）で保存。群・RAGフラグを必ず記録。
-- =============================================================

-- 参加者コード採番用（P001, P002, ...）
create sequence if not exists participant_seq;

alter table participants
  add column if not exists participant_code text,
  add column if not exists consent      boolean not null default false,
  add column if not exists consent_at   timestamptz,
  add column if not exists started_at   timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists ai_freq      int,          -- 1〜4
  add column if not exists t1_rag       boolean,      -- テーマ1でRAGありか
  add column if not exists t2_rag       boolean,      -- テーマ2でRAGありか
  add column if not exists t1_turn_count int,
  add column if not exists t1_duration_sec int,
  add column if not exists t2_turn_count int,
  add column if not exists t2_duration_sec int,
  add column if not exists free_1 text,
  add column if not exists free_2 text,
  add column if not exists free_3 text,
  -- テーマ1（すべて int 1〜4）
  add column if not exists t1_pre_1 int, add column if not exists t1_pre_2 int,
  add column if not exists t1_pre_3 int, add column if not exists t1_pre_4 int,
  add column if not exists t1_post_1 int, add column if not exists t1_post_2 int,
  add column if not exists t1_post_3 int, add column if not exists t1_post_4 int,
  add column if not exists t1_resp_1 int, add column if not exists t1_resp_2 int,
  add column if not exists t1_resp_3 int,
  add column if not exists t1_mode_1 int,
  -- テーマ2（すべて int 1〜4）
  add column if not exists t2_pre_1 int, add column if not exists t2_pre_2 int,
  add column if not exists t2_pre_3 int, add column if not exists t2_pre_4 int,
  add column if not exists t2_post_1 int, add column if not exists t2_post_2 int,
  add column if not exists t2_post_3 int, add column if not exists t2_post_4 int,
  add column if not exists t2_resp_1 int, add column if not exists t2_resp_2 int,
  add column if not exists t2_resp_3 int,
  add column if not exists t2_mode_1 int;

create unique index if not exists participants_code_idx on participants(participant_code);

-- 参加者シーケンスの次値を取得（採番・群の交互割当に使用）
create or replace function next_participant_seq() returns bigint language sql volatile as $$
  select nextval('participant_seq');
$$;
grant execute on function next_participant_seq() to anon, authenticated, service_role;
