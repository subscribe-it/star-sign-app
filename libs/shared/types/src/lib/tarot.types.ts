export interface TarotCardImage {
  id?: number;
  documentId?: string;
  name?: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  formats?: Record<string, unknown> | null;
  url: string;
}

export interface TarotCard {
  id: number;
  documentId: string;
  name: string;
  arcana: string;
  meaning_upright: string;
  meaning_reversed?: string;
  description: string;
  symbol: string;
  slug: string;
  image?: TarotCardImage | null;
}

export interface DailyTarotDrawResponse {
  date: string;
  card: TarotCard | null;
  message?: string;
}
