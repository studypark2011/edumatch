-- =============================================================
-- 属性の修正：立場を複数選択（text[]）に、経験年数を追加
-- =============================================================

-- role を text -> text[]（既存データは配列にラップ。基本はデータ無し想定）
alter table participants
  alter column role type text[] using (
    case when role is null then null else array[role] end
  );

alter table participants
  add column if not exists experience text;  -- '5年未満' | '5〜15年' | '15年以上'
