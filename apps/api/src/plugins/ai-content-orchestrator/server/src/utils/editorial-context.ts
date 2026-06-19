import { EDITORIAL_MEMORY_UID } from '../constants';
import type { EditorialMemoryRecord, Strapi } from '../types';
import { getEntityService } from './entity-service';
import { toSafeErrorMessage } from './json';

// Maksymalna długość bloku kontekstu redakcyjnego wstrzykiwanego do promptu.
// Twardy limit chroni budżet tokenów — niezależnie od liczby wpisów w bazie
// preambuła nie może rozsadzić promptu.
export const EDITORIAL_CONTEXT_MAX_CHARS = 1500;

// Typy pamięci redakcyjnej, które mają sens jako globalny kontekst generacji.
// Celowo POMIJAMY 'persona' (obsługiwana per-persona) oraz 'custom' (insighty
// techniczne/wewnętrzne zapisywane przez insights-engine, nieprzeznaczone do
// promptu twórczego).
const INCLUDED_MEMORY_TYPES: ReadonlyArray<EditorialMemoryRecord['memory_type']> = [
  'brand_voice',
  'seo_rule',
  'prohibited_phrase',
  'linking_rule',
];

// Czytelne polskie etykiety grup, używane jako nagłówki w bloku instrukcji.
const MEMORY_TYPE_LABELS: Record<string, string> = {
  brand_voice: 'Głos marki',
  seo_rule: 'Zasady SEO',
  prohibited_phrase: 'Zwroty zakazane',
  linking_rule: 'Zasady linkowania',
};

/**
 * Buduje zwięzły, polski blok instrukcji redakcyjnych z aktywnych wpisów
 * editorial-memory (active === true), posortowanych po priorytecie malejąco
 * i pogrupowanych po typie pamięci.
 *
 * Aktywuje (dotąd nieużywaną) pamięć redakcyjną w generacji treści.
 *
 * Zwraca '' gdy brak aktywnych wpisów — dzięki temu dopóki operator nie doda
 * żadnej pozycji, zachowanie jest identyczne jak dotychczas (brak preambuły).
 */
export const buildEditorialContext = async (strapi: Strapi): Promise<string> => {
  const entityService = getEntityService(strapi);

  let entries: EditorialMemoryRecord[];
  try {
    entries = await entityService.findMany<EditorialMemoryRecord>(EDITORIAL_MEMORY_UID, {
      filters: { active: true },
      sort: [{ priority: 'desc' }, { id: 'asc' }],
    });
  } catch (error) {
    strapi.log.warn(
      `[aico] Nie udało się wczytać pamięci redakcyjnej, pomijam kontekst: ${toSafeErrorMessage(error)}`
    );
    return '';
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }

  const sections: string[] = [];

  for (const memoryType of INCLUDED_MEMORY_TYPES) {
    const group = entries.filter((entry) => entry.memory_type === memoryType);

    if (group.length === 0) {
      continue;
    }

    const heading = MEMORY_TYPE_LABELS[memoryType] ?? memoryType;
    const lines = group
      .map((entry) => {
        const label = entry.label?.trim();
        const content = entry.content?.trim();

        if (!content) {
          return '';
        }

        return label ? `- ${label}: ${content}` : `- ${content}`;
      })
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      continue;
    }

    sections.push(`${heading}:\n${lines.join('\n')}`);
  }

  if (sections.length === 0) {
    return '';
  }

  const block = `Zasady redakcyjne (stosuj się do nich ściśle):\n\n${sections.join('\n\n')}`;

  if (block.length <= EDITORIAL_CONTEXT_MAX_CHARS) {
    return block;
  }

  // Twarde przycięcie do limitu, by nigdy nie przekroczyć budżetu promptu.
  return `${block.slice(0, EDITORIAL_CONTEXT_MAX_CHARS - 1).trimEnd()}…`;
};
