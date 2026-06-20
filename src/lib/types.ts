export type Theme = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  rag_tag: string;
  sort_order: number;
};

export type DocumentRow = {
  id: string;
  title: string;
  source_type: "url" | "file" | "text";
  source_url: string | null;
  tags: string[];
  status: "pending" | "processing" | "ready" | "error";
  char_count: number;
  chunk_count: number;
  error: string | null;
  created_at: string;
};

export type Mode = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  system_prompt: string;
  sort_order: number;
};

export type ExperimentConfig = {
  id: string;
  theme_slug: string;
  group_label: "X" | "Y";
  displayed_mode: "A" | "B";
  dialogue_mode_key: string;
  rag_enabled: boolean;
};

export type Citation = {
  document_id: string;
  title: string;
  source_url: string | null;
  chunk_index: number;
  snippet: string;
  similarity: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type MatchChunkRow = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
  title: string;
  source_url: string | null;
};
