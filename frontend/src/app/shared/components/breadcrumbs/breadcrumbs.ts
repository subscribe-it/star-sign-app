import {
  Component,
  ChangeDetectionStrategy,
  inject,
  effect,
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  UrlSegment,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { SeoService } from '../../../core/services/seo.service';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav
      class="flex text-xs uppercase tracking-widest text-mystic-cocoa mb-8"
      aria-label="Breadcrumb"
    >
      <ol class="list-none p-0 inline-flex">
        <li class="flex items-center">
          <a routerLink="/" class="hover:text-mystic-rose transition-colors"
            >Start</a
          >
          @if (breadcrumbs().length > 0) {
            <span class="mx-2 opacity-50">/</span>
          }
        </li>
        @for (
          breadcrumb of breadcrumbs();
          track breadcrumb.url;
          let last = $last
        ) {
          <li class="flex items-center">
            @if (last) {
              <span class="text-mystic-rose font-medium">{{
                breadcrumb.label
              }}</span>
            } @else {
              <a
                [routerLink]="breadcrumb.url"
                class="hover:text-mystic-rose transition-colors"
                >{{ breadcrumb.label }}</a
              >
              <span class="mx-2 opacity-50">/</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);
  private readonly seoService = inject(SeoService);

  public readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.buildBreadcrumbs(this.router.routerState.snapshot.root)),
    ),
    { initialValue: [] as Breadcrumb[] },
  );

  constructor() {
    // Emit a schema.org BreadcrumbList for richer search results. The visible
    // trail always begins with the "Start" (home) link, so we mirror that as
    // the first list item. SSR-safe: the SeoService writes via the injected
    // DOCUMENT, never touching window/document directly.
    effect(() => {
      const trail = this.breadcrumbs();

      if (trail.length === 0) {
        this.seoService.setBreadcrumbsJsonLd([]);
        return;
      }

      this.seoService.setBreadcrumbsJsonLd([
        { name: 'Start', url: '/' },
        ...trail.map((crumb) => ({ name: crumb.label, url: crumb.url })),
      ]);
    });
  }

  private buildBreadcrumbs(
    route: ActivatedRouteSnapshot,
    url = '',
    breadcrumbs: Breadcrumb[] = [],
  ): Breadcrumb[] {
    const children = route.children;

    if (children.length === 0) {
      return breadcrumbs;
    }

    for (const child of children) {
      const routeURL: string = child.url
        .map((segment: UrlSegment) => segment.path)
        .join('/');
      if (routeURL !== '') {
        url += `/${routeURL}`;
      }

      const label = this.getLabel(child);
      if (label) {
        breadcrumbs.push({ label, url });
      }

      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs;
  }

  private getLabel(route: ActivatedRouteSnapshot): string | null {
    const path = route.routeConfig?.path;
    if (!path) return null;

    // Static mapping
    const labels: Record<string, string> = {
      artykuly: 'Blog',
      horoskopy: 'Astrologia',
      tarot: 'Tarot',
      numerologia: 'Numerologia',
      kosmogram: 'Kosmogram',
      sklep: 'Sklep',
      panel: 'Mój Profil',
      logowanie: 'Logowanie',
      rejestracja: 'Rejestracja',
      'o-nas': 'O nas',
      kontakt: 'Kontakt',
    };

    if (labels[path]) return labels[path];

    // Dynamic labels from params or data
    const paramValue =
      route.params['slug'] || route.params['sign'] || route.params['type'];
    if (typeof paramValue === 'string' && paramValue) {
      const param = paramValue;
      return param.charAt(0).toUpperCase() + param.slice(1).replace(/-/g, ' ');
    }

    return null;
  }
}
