import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  simpleInstagram,
  simpleTiktok,
  simplePinterest,
} from '@ng-icons/simple-icons';
import { featureFlags } from '../../feature-flags';
import { CookieConsentService } from '../../services/cookie-consent.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, NgIcon],
  viewProviders: [
    provideIcons({ simpleInstagram, simpleTiktok, simplePinterest }),
  ],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  private readonly cookieConsentService = inject(CookieConsentService);

  public readonly currentYear = new Date().getFullYear();
  public readonly shopEnabled = featureFlags.shopEnabled;

  public readonly navLinks = [
    { label: 'Horoskopy', path: '/horoskopy' },
    { label: 'Tarot Online', path: '/tarot' },
    { label: 'Blog', path: '/artykuly' },
    ...(this.shopEnabled ? [{ label: 'Sklep Magiczny', path: '/sklep' }] : []),
    { label: 'Numerologia', path: '/numerologia' },
  ];

  public readonly socials: { label: string; icon: string; href: string }[] = [];

  public manageCookieConsent(): void {
    this.cookieConsentService.reopen();
  }
}
