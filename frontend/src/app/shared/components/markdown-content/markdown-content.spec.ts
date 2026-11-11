import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MarkdownContent, renderMarkdown } from './markdown-content';

describe('renderMarkdown', () => {
  it('renders headings, bold and paragraphs', () => {
    const html = renderMarkdown('## Tytuł\n\nAkapit z **ważnym** słowem.');
    expect(html).toContain('<h2>Tytuł</h2>');
    expect(html).toContain('<strong>ważnym</strong>');
    expect(html).toContain('<p>Akapit');
  });

  it('renders lists (psychotest answers)', () => {
    const html = renderMarkdown(
      '**1. Pytanie?**\n\n- A) jeden\n- B) dwa\n\n### Wyniki',
    );
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)?.length).toBe(2);
    expect(html).toContain('<h3>Wyniki</h3>');
  });

  it('keeps internal links plain and opens external ones safely', () => {
    const html = renderMarkdown(
      '[Panna](/znaki/panna) i [zewn](https://example.com)',
    );
    expect(html).toContain('<a href="/znaki/panna">Panna</a>');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">zewn</a>',
    );
  });

  it('drops javascript: links and escapes raw html', () => {
    const html = renderMarkdown(
      '[x](javascript:alert(1)) <script>alert(1)</script> <img src=x onerror=alert(1)>',
    );
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
  });

  it('hides HTML comments (quiz marker) but still escapes other html', () => {
    const html = renderMarkdown('Treść.\n\n<!-- quiz -->\n\n## Test: Panna\n\n<b>x</b>');
    expect(html).not.toContain('quiz --');
    expect(html).not.toContain('&lt;!--');
    expect(html).toContain('<h2>Test: Panna</h2>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('treats absolute links to star-sign.pl as internal', () => {
    const html = renderMarkdown(
      '[profil](https://star-sign.pl/znaki/panna) [home](https://www.star-sign.pl)',
    );
    expect(html).toContain('<a href="/znaki/panna">profil</a>');
    expect(html).toContain('<a href="/">home</a>');
    expect(html).not.toContain('target="_blank"');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('  ')).toBe('');
    expect(renderMarkdown(null)).toBe('');
  });
});

describe('MarkdownContent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MarkdownContent],
      providers: [provideRouter([])],
    });
  });

  it('renders sanitized markdown without script or handlers', () => {
    const fixture = TestBed.createComponent(MarkdownContent);
    fixture.componentRef.setInput(
      'content',
      '## Test\n\n- A\n- B\n\n<img src=x onerror=alert(1)>',
    );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toBe('Test');
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();
  });

  it('navigates internal links via router', () => {
    const fixture = TestBed.createComponent(MarkdownContent);
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentRef.setInput('content', '[Panna](/znaki/panna)');
    fixture.detectChanges();
    const a = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(nav).toHaveBeenCalledWith('/znaki/panna');
  });
});
