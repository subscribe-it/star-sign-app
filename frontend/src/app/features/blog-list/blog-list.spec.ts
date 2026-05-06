import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogList } from './blog-list';
import { ArticleService } from '../../core/services/article.service';
import { of, throwError } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { SeoService } from '../../core/services/seo.service';

describe('BlogList', () => {
  let component: BlogList;
  let fixture: ComponentFixture<BlogList>;
  let articleService: any;
  let seoService: any;

  const mockResponse = {
    data: [
      {
        id: '1',
        title: 'Article 1',
        slug: 'art-1',
        category: { name: 'Category 1' },
      },
      {
        id: '2',
        title: 'Article 2',
        slug: 'art-2',
        category: { name: 'Category 2' },
      },
    ],
    meta: {
      pagination: {
        page: 1,
        pageSize: 12,
        pageCount: 2,
        total: 24,
      },
    },
  };

  beforeEach(async () => {
    // Mock IntersectionObserver
    global.IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as any;

    articleService = {
      getArticles: vi.fn().mockReturnValue(of(mockResponse)),
    };
    seoService = {
      absoluteUrl: vi.fn((path: string) => `https://star-sign.pl${path}`),
      updateSeo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BlogList, RouterTestingModule],
      providers: [
        { provide: ArticleService, useValue: articleService },
        { provide: SeoService, useValue: seoService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should configure SEO for article collection page', () => {
    expect(seoService.updateSeo).toHaveBeenCalledWith(
      'Artykuły o astrologii, tarocie i numerologii',
      expect.any(String),
      expect.objectContaining({
        canonicalUrl: 'https://star-sign.pl/artykuly',
        jsonLd: expect.objectContaining({
          '@type': 'CollectionPage',
          url: 'https://star-sign.pl/artykuly',
        }),
      }),
    );
  });

  it('should load articles on init', () => {
    expect(articleService.getArticles).toHaveBeenCalledWith(
      1,
      12,
      'Wszystko',
      '',
    );
    expect(component.articles().length).toBe(2);
    expect(component.hasMore()).toBe(true);
  });

  it('should filter categories correctly', () => {
    expect(component.categories()).toEqual([
      'Wszystko',
      'Category 1',
      'Category 2',
    ]);
  });

  it('should change category and reload', () => {
    component.setCategory('Category 1');
    fixture.detectChanges();
    // Second call due to effect on activeCategory
    expect(articleService.getArticles).toHaveBeenCalledWith(
      1,
      12,
      'Category 1',
      '',
    );
    expect(component.activeCategory()).toBe('Category 1');
  });

  it('should load more articles', () => {
    component.loadMore();
    expect(articleService.getArticles).toHaveBeenCalledWith(
      2,
      12,
      'Wszystko',
      '',
    );
    expect(component.currentPage()).toBe(1); // Still 1 because mock returns page 1 in response.
    // In a real scenario, the second call would return page 2.
  });

  it('should handle error', () => {
    articleService.getArticles.mockReturnValue(
      throwError(() => new Error('Error')),
    );
    component.setCategory('Error Test');
    fixture.detectChanges();
    expect(component.error()).toBe('Nie udało się pobrać artykułów.');
  });

  it('should render loading skeletons', () => {
    component.articles.set([]);
    component.loading.set(true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Mistycyzm na co dzień',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.animate-pulse')
        .length,
    ).toBeGreaterThan(0);
  });

  it('should render visual placeholders when article thumbnails are missing', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector('[data-test="blog-hero-image-placeholder"]'),
    ).toBeTruthy();
    expect(
      host.querySelector('[data-test="blog-article-image-placeholder"]'),
    ).toBeTruthy();
  });

  it('should render article thumbnail images when provided by the API', () => {
    component.articles.set([
      {
        id: 10,
        documentId: 'article-10',
        title: 'Article with hero image',
        slug: 'article-with-hero-image',
        category: { name: 'Category 1', slug: 'category-1' },
        image: {
          url: '/uploads/blog_placeholder.webp',
          alternativeText: 'Miniatura hero',
        },
      },
      {
        id: 11,
        documentId: 'article-11',
        title: 'Article with card image',
        slug: 'article-with-card-image',
        category: { name: 'Category 2', slug: 'category-2' },
        image: {
          url: '/uploads/blog_card.webp',
          alternativeText: 'Miniatura karty',
        },
      },
    ]);
    component.loading.set(false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('img[alt="Miniatura hero"]')).toBeTruthy();
    expect(host.querySelector('img[alt="Miniatura karty"]')).toBeTruthy();
    expect(
      host.querySelector('[data-test="blog-hero-image-placeholder"]'),
    ).toBeFalsy();
  });

  it('should render empty state when no articles are available', () => {
    component.articles.set([]);
    component.loading.set(false);
    component.error.set(null);
    component.searchQuery.set('');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Artykuły są jeszcze przygotowywane',
    );
  });

  it('should render search empty state and clear search', () => {
    articleService.getArticles.mockReturnValue(
      of({
        data: [],
        meta: {
          pagination: {
            page: 1,
            pageSize: 12,
            pageCount: 1,
            total: 0,
          },
        },
      }),
    );
    component.searchQuery.set('księżyc');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Brak wyników dla "księżyc"');

    const clearButtons = host.querySelectorAll('button');
    clearButtons[clearButtons.length - 1].dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(component.searchQuery()).toBe('');
  });

  it('should render category empty state and reset category', () => {
    component.activeCategory.set('Category 3');
    component.articles.set([
      {
        id: 3,
        documentId: 'article-3',
        title: 'Article 3',
        slug: 'art-3',
        category: { name: 'Category 1', slug: 'category-1' },
      },
    ]);
    component.loading.set(false);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Brak artykułów w tej kategorii');

    const showAllButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Pokaż wszystkie'),
    ) as HTMLButtonElement;
    showAllButton.click();

    expect(component.activeCategory()).toBe('Wszystko');
  });

  it('should render loading more indicator', () => {
    component.articles.set([
      {
        id: 4,
        documentId: 'article-4',
        title: 'Article 4',
        slug: 'art-4',
      },
      {
        id: 5,
        documentId: 'article-5',
        title: 'Article 5',
        slug: 'art-5',
      },
    ]);
    component.loading.set(false);
    component.loadingMore.set(true);
    component.hasMore.set(true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Wczytywanie kolejnych wpisów',
    );
  });
});
