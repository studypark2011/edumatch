-- 検証用アプリでは「対話→意見投稿」導線（機能③）を使わないため posts を削除。
-- フル機能版は別の本番環境に実装済み。
drop table if exists posts cascade;
