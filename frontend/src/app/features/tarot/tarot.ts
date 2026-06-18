import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroSparkles,
  heroMoon,
  heroHeart,
  heroLockClosed,
} from '@ng-icons/heroicons/outline';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-tarot',
  imports: [RouterLink, NgIcon],
  viewProviders: [
    provideIcons({ heroSparkles, heroMoon, heroHeart, heroLockClosed }),
  ],
  templateUrl: './tarot.html',
  styleUrl: './tarot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tarot {
  private readonly seoService = inject(SeoService);

  public readonly spreads = [
    {
      id: 'karta-dnia',
      name: 'Karta Dnia',
      description:
        'Poznaj swoje jednokartowe przesłanie na dzisiaj. Idealny punkt startowy na każdy poranek.',
      icon: 'heroSparkles',
      locked: false,
      link: '/tarot/karta-dnia' as string | null,
    },
    {
      id: 'rozkad-milosny',
      name: 'Rozkład Miłosny',
      description:
        'Zgłęb tajemnice swojego życia uczuciowego za pomocą klasycznego rozkładu trzech kart.',
      icon: 'heroHeart',
      locked: true,
      link: null as string | null,
    },
    {
      id: 'tarot-ksiezycowy',
      name: 'Wróżba Księżycowa',
      description:
        'Przesłanie połączone z obecną fazą Księżyca. Odkryj co skrywa podświadomość.',
      icon: 'heroMoon',
      locked: true,
      link: null as string | null,
    },
  ];

  constructor() {
    const canonicalUrl = this.seoService.absoluteUrl('/tarot');
    this.seoService.updateSeo(
      'Tarot online — wybierz rozkład',
      'Odkryj głęboki wgląd Tarota w Star Sign. Wybierz rozkład, wylosuj Kartę Dnia i poznaj swoje przesłanie na dziś.',
      {
        canonicalUrl,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Tarot Star Sign',
          description:
            'Rozkłady Tarota w Star Sign: Karta Dnia, rozkład miłosny i wróżba księżycowa.',
          url: canonicalUrl,
          hasPart: this.spreads.map((spread) => ({
            '@type': 'CreativeWork',
            name: spread.name,
            description: spread.description,
            url: spread.link
              ? this.seoService.absoluteUrl(spread.link)
              : canonicalUrl,
          })),
        },
      },
    );
  }
}
