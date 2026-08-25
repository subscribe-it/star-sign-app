import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';

import { CookieConsentService } from '../../services/cookie-consent.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = 'adsbygoogle-js';
let adsenseScriptRequested = false;

const loadAdSenseScript = (clientId: string): void => {
  if (adsenseScriptRequested || document.getElementById(ADSENSE_SCRIPT_ID)) {
    return;
  }
  adsenseScriptRequested = true;
  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
  document.head.appendChild(script);
};

/**
 * Reklamowy slot display (Google AdSense), zgodny z RODO: skrypt ładuje się
 * wyłącznie w przeglądarce i po zgodzie marketing w cookie bannerze.
 * Bez ADSENSE_CLIENT_ID w runtime-config renderuje neutralny placeholder
 * (identyczny z obecnym wyglądem) — zero zmian wizualnych bez konfiguracji.
 */
@Component({
  selector: 'app-ad-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="boxClass()">
      @if (active()) {
        <ins
          class="adsbygoogle"
          style="display:block;width:100%;height:100%"
          [attr.data-ad-client]="clientId()"
          [attr.data-ad-slot]="slotId() || null"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      } @else {
        <span
          class="text-xs sm:text-sm uppercase tracking-widest mb-2 font-medium text-mystic-rose"
        >
          Reklama
        </span>
        <span class="text-lg sm:text-xl serif-display text-mystic-cocoa">
          {{ placeholderTitle() }}
        </span>
      }
    </div>
  `,
})
export class AdSlotComponent {
  public readonly slotId = input<string>('');
  public readonly placeholderTitle = input<string>('');
  public readonly boxClass = input<string>(
    'w-full h-24 sm:h-32 md:h-40 border border-dashed border-mystic-rose/30 bg-white/50 rounded-3xl flex flex-col items-center justify-center transition-all overflow-hidden',
  );

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly consent = inject(CookieConsentService);
  private readonly runtimeConfig = inject(RuntimeConfigService);

  public readonly clientId = this.runtimeConfig.adsenseClientId;

  public readonly active = computed(
    () => this.clientId().length > 0 && this.consent.marketingAllowed(),
  );

  constructor() {
    effect(() => {
      if (!this.isBrowser) return;
      const clientId = this.clientId();
      if (!clientId || !this.active()) return;
      loadAdSenseScript(clientId);
      requestAnimationFrame(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          // Ignorujemy błędy sieciowe AdSense — placeholder zostaje.
        }
      });
    });
  }
}
