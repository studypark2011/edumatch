-- =============================================================
-- 条件確認用ビュー：誰が群X/Yで、各テーマでRAGが効いていたかを一目で確認
-- Supabase の Table Editor（Views）または SQL Editor から参照できる。
-- =============================================================
create or replace view conditions_overview as
select
  participant_code,
  group_label,                          -- 群（X / Y）
  t1_rag       as theme1_rag,           -- テーマ1でRAGあり（true/false）
  t2_rag       as theme2_rag,           -- テーマ2でRAGあり（true/false）
  (completed_at is not null) as completed,
  started_at,
  completed_at
from participants;

grant select on conditions_overview to anon, authenticated, service_role;
