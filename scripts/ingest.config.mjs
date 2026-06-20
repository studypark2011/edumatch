// RAGに取り込む文書の一覧。path はローカル絶対パス（/ 区切り可）。
// tag: 'theme1' | 'theme2' | 'common'（単一） / tags: [...]（複数タグ）
// ※ 既に登録済みの文書はここから外す（重複登録を避けるため）。
export const docs = [
  {
    path: "C:/Users/hp/Downloads/生徒指導要提20230220-mxt_jidou01-000024699-201-1.pdf",
    tags: ["theme2"],
    title: "生徒指導提要（改訂版）（文部科学省, 2022年12月）",
  },
  {
    path: "C:/Users/hp/Downloads/校則見直し20210624-mext_jidou01-000016155_001.pdf",
    tags: ["theme2"],
    title: "校則の見直し等に関する取組事例について（文部科学省, 2021年6月）",
  },
  {
    path: "C:/Users/hp/Downloads/こども基本法77setsumei.pdf",
    tags: ["theme2"],
    title: "こども基本法 説明資料（こども家庭庁）",
  },
  {
    path: "C:/Users/hp/Downloads/OECD_LEARNING_COMPASS_2030_Concept_note_Japanese.pdf",
    tags: ["theme1", "theme2"],
    title: "OECD ラーニング・コンパス2030（コンセプトノート 日本語版）",
  },
];
