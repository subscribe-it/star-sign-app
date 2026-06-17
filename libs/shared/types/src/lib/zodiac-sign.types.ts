export interface ZodiacSign {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  date_range: string;
  element: string;
  planet?: string;
  symbol?: string;
  description?: string;
  strengths?: string[];
  challenges?: string[];
  compatibility?: string[];
  image?: {
    url: string;
    alternativeText?: string;
    width?: number;
    formats?: Record<string, { url: string; width?: number }>;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}
