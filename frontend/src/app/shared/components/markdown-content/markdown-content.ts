import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { Marked, Tokens } from 'marked';

const INTERNAL_LINK = /^\/(?!\/)/;
const EXTERNAL_LINK = /^https?:\/\//i;
// Absolutne linki do własnej domeny (np. CTA z generatora treści) traktujemy jak wewnętrzne.
const OWN_ORIGIN = /^https?:\/\/(?:www\.)?star-sign\.pl(?=\/|$)/i;
const HTML_COMMENT = /^\s*<!--[\s\S]*?-->\s*$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const marked = new Marked({ gfm: true, breaks: false });
marked.use({
  renderer: {
    // Surowy HTML z CMS nie jest przepuszczany - wyświetlamy go jako tekst.
    html(token: Tokens.HTML | Tokens.Tag): string {
      // Komentarze HTML (np. znacznik <!-- quiz --> z generatora) są niewidoczne.
      if (HTML_COMMENT.test(token.text)) {
        return '';
      }
      return escapeHtml(token.text);
    },
    link(this, token: Tokens.Link): string {
      const text = this.parser.parseInline(token.tokens);
      const href = (token.href ?? '').replace(OWN_ORIGIN, '') || '/';
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      if (INTERNAL_LINK.test(href)) {
        return `<a href="${escapeHtml(href)}"${title}>${text}</a>`;
      }
      if (EXTERNAL_LINK.test(href)) {
        return `<a href="${escapeHtml(href)}"${title} target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      // Inne schematy (javascript:, data: ...) i linki względne - sam tekst.
      return text;
    },
  },
});

/** Renderuje markdown (bezpiecznie, SSR-owo) do HTML. Wynik i tak przechodzi przez sanitizer Angulara w [innerHTML]. */
export function renderMarkdown(source: string | null | undefined): string {
  const text = source?.trim();
  return text ? (marked.parse(text, { async: false }) as string) : '';
}

/**
 * Wyświetla treść markdown z CMS. Linki wewnętrzne ("/znaki/panna") nawigują
 * przez Router (bez przeładowania strony). Style: markdown-content.scss (ViewEncapsulation.None, ląduje w leniwym chunku).
 */
@Component({
  selector: 'app-markdown-content',
  template: `<div
    class="markdown-body"
    [innerHTML]="html()"
    (click)="onClick($event)"
  ></div>`,
  styleUrl: './markdown-content.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownContent {
  private readonly router = inject(Router);

  public readonly content = input<string | null | undefined>(null);
  public readonly html = computed(() => renderMarkdown(this.content()));

  public onClick(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = (event.target as HTMLElement | null)?.closest?.('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || !INTERNAL_LINK.test(href)) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(href);
  }
}
