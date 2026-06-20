// RAGに取り込む文書の一覧。path はローカル絶対パス（/ 区切り可）。
// tag: 'theme1' | 'theme2' | 'common'（単一） / tags: [...]（複数タグ）
// ※ 既に登録済みの文書はここから外す（重複登録を避けるため）。
export const docs = [
  {
    path: "C:/Users/hp/Downloads/小学校指導要領20230120-mxt_kyoiku02-100002604_01.pdf",
    tags: ["theme1", "theme2"],
    title: "小学校学習指導要領（平成29年告示）",
  },
  {
    path: "C:/Users/hp/Downloads/中学校指導要領20230120-mxt_kyoiku02-100002604_02.pdf",
    tags: ["theme1", "theme2"],
    title: "中学校学習指導要領（平成29年告示）",
  },
  {
    path: "C:/Users/hp/Downloads/高校指導要領20230120-mxt_kyoiku02-100002604_03.pdf",
    tags: ["theme1", "theme2"],
    title: "高等学校学習指導要領（平成30年告示）",
  },
];
