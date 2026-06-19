import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, of } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronLeft, heroSparkles } from '@ng-icons/heroicons/outline';

import {
  AuthorService,
  PublicAuthor,
} from '../../core/services/author.service';
import { ArticleService } from '../../core/services/article.service';
import { SeoService } from '../../core/services/seo.service';
import { Article } from '@star-sign-monorepo/shared-types';
import { environment } from '../../../environments/environment';
import { StrapiImagePipe } from '../../core/pipes/strapi-image-pipe';

/**
 * Public author page (E-E-A-T authorship). Renders a real, named editor persona
 * — byline, specialization, bio, avatar — plus that author's recent articles.
 * SSR-safe: all data flows through signals derived from the route param, and SEO
 * (canonical + Person JSON-LD) is written via the DOCUMENT-based SeoService.
 */
@Component({
  selector: 'app-author',
  standalone: true,
  imports: [RouterLink, NgIcon, StrapiImagePipe],
  viewProviders: [provideIcons({ heroChevronLeft, heroSparkles })],
  templateUrl: './author.html',
  styleUrl: './author.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Author {
  private readonly route = inject(ActivatedRoute);
  private readonly authorService = inject(AuthorService);
  private readonly articleService = inject(ArticleService);
  private readonly seoService = inject(SeoService);

  private readonly key = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('key'))),
    { initialValue: null },
  );

  /** undefined = still loading, null = not found, object = loaded. */
  public readonly author = toSignal<PublicAuthor | null | undefined>(
    toObservable(this.key).pipe(
      switchMap((key) => {
        if (!key) {
          return of(null);
        }
        return this.authorService
          .getAuthorByKey(key)
          .pipe(map((author) => author ?? null));
      }),
    ),
    { initialValue: undefined },
  );

  public readonly articles = toSignal(
    toObservable(this.author).pipe(
      switchMap((author) => {
        if (!author?.key) {
          return of([] as Article[]);
        }
        return this.articleService.getArticlesByPersonaKey(author.key);
      }),
    ),
    { initialValue: [] as Article[] },
  );

  public readonly isLoading = computed(() => this.author() === undefined);
  public readonly notFound = computed(() => this.author() === null);

  public readonly displayName = computed(() => {
    const author = this.author();
    return author?.byline?.trim() || 'Autor Star Sign';
  });

  constructor() {
    effect(() => {
      const author = this.author();
      if (!author?.key) {
        return;
      }

      const name = this.displayName();
      const description =
        author.specialization?.trim() ||
        author.bio?.trim()?.slice(0, 160) ||
        `Poznaj autora Star Sign: ${name}.`;
      const canonicalUrl = this.seoService.absoluteUrl(
        `/redakcja/${author.key}`,
      );
      const imageUrl = author.avatar?.url
        ? this.seoService.absoluteUrl(this.absoluteAvatar(author.avatar.url))
        : undefined;

      this.seoService.updateSeo(name, description, {
        canonicalUrl,
        type: 'website',
        imageUrl,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name,
          description,
          jobTitle: author.specialization || undefined,
          image: imageUrl,
          url: canonicalUrl,
          worksFor: {
            '@type': 'Organization',
            name: 'Star Sign',
            url: this.seoService.absoluteUrl('/'),
          },
        },
      });
    });
  }

  public avatarUrl(author: PublicAuthor): string {
    return author.avatar?.url ? this.absoluteAvatar(author.avatar.url) : '';
  }

  /**
   * Resolves a Strapi avatar path to an absolute URL for crawlers, matching
   * StrapiImagePipe (relative paths are served under apiUrl) before
   * SeoService.absoluteUrl() anchors it against siteUrl.
   */
  private absoluteAvatar(url: string): string {
    return url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
  }
}
