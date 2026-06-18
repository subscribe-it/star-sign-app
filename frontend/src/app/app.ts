import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Navbar } from './core/components/navbar/navbar';
import { Footer } from './core/components/footer/footer';
import { CartComponent } from '@org/cart';
import {
  CartItem,
  PublicAppSettingsResponse,
} from '@star-sign-monorepo/shared-types';
import { NotificationToastComponent } from './core/components/notification-toast';
import { CheckoutService } from './core/services/checkout.service';
import { featureFlags } from './core/feature-flags';
import { CookieBanner } from './core/components/cookie-banner/cookie-banner';
import { LoadingBar } from './core/components/loading-bar/loading-bar';
import { AnalyticsService } from './core/services/analytics.service';
import { SeoService } from './core/services/seo.service';
import {
  AppSettingsService,
  DEFAULT_PUBLIC_APP_SETTINGS,
} from './core/services/app-settings.service';
import { MaintenanceMode } from './core/components/maintenance-mode/maintenance-mode';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Navbar,
    Footer,
    CartComponent,
    CookieBanner,
    NotificationToastComponent,
    LoadingBar,
    MaintenanceMode,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly checkoutService = inject(CheckoutService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly appSettingsService = inject(AppSettingsService);
  private readonly seoService = inject(SeoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly appSettings = toSignal<
    PublicAppSettingsResponse | undefined
  >(this.appSettingsService.getPublicAppSettings(), {
    initialValue: undefined,
  });
  protected readonly title = signal('Star Sign');
  public readonly shopEnabled = featureFlags.shopEnabled;
  public readonly cart = viewChild<CartComponent>(CartComponent);
  public readonly checkoutInProgress = signal(false);
  public readonly currentPath = signal(this.normalizePath(this.router.url));
  public readonly maintenanceChecking = computed(
    () => this.appSettings() === undefined,
  );
  public readonly maintenanceSettings = computed(
    () =>
      this.appSettings()?.maintenanceMode ??
      DEFAULT_PUBLIC_APP_SETTINGS.maintenanceMode,
  );
  public readonly maintenanceVisible = computed(() => {
    if (this.maintenanceChecking()) {
      return true;
    }

    const settings = this.maintenanceSettings();
    return (
      settings.enabled &&
      !this.isMaintenanceAllowedPath(this.currentPath(), settings.allowedPaths)
    );
  });

  public ngOnInit(): void {
    this.analyticsService.init();
    this.seoService.setSiteJsonLd();
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentPath.set(this.normalizePath(event.urlAfterRedirects));
      });
  }

  public openCart(): void {
    if (!this.shopEnabled) {
      return;
    }

    this.cart()?.toggle();
  }

  public startCheckout(items: CartItem[]): void {
    if (!this.shopEnabled || !items.length || this.checkoutInProgress()) {
      return;
    }

    this.checkoutInProgress.set(true);

    this.analyticsService.trackBeginCheckout(items, { checkout_type: 'shop' });

    this.checkoutService
      .createSession({
        items: items.map((item) => ({
          productDocumentId: item.product.documentId,
          quantity: item.quantity,
        })),
      })
      .subscribe({
        next: (response) => {
          this.analyticsService.trackCheckoutRedirect({
            type: 'shop',
          });
          window.location.assign(response.checkoutUrl);
        },
        error: (error) => {
          console.error('Nie udało się zainicjalizować płatności.', error);
          this.analyticsService.trackEvent('checkout_error', {
            type: 'shop',
            error: error.message,
          });
          this.checkoutInProgress.set(false);
        },
      });
  }

  private normalizePath(url: string): string {
    const path = url.split('?')[0].split('#')[0] || '/';
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  }

  private isMaintenanceAllowedPath(
    path: string,
    allowedPaths: string[],
  ): boolean {
    return allowedPaths.some((allowedPath) => {
      const normalizedAllowedPath = this.normalizePath(allowedPath);
      return (
        path === normalizedAllowedPath ||
        (normalizedAllowedPath !== '/' &&
          path.startsWith(`${normalizedAllowedPath}/`))
      );
    });
  }
}
