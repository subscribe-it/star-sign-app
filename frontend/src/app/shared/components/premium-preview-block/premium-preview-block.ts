import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarkdownContent } from '../markdown-content/markdown-content';
import { PREMIUM_PREVIEW_ITEMS } from './premium-preview.config';

@Component({
  selector: 'app-premium-preview-block',
  imports: [RouterLink, MarkdownContent],
  templateUrl: './premium-preview-block.html',
  styleUrl: './premium-preview-block.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PremiumPreviewBlock {
  public readonly variant = input<PremiumPreviewVariant>('generic');
  public readonly isPremium = input(false);
  public readonly premiumContent = input<string | null | undefined>(null);
  public readonly hasPremiumContent = input<boolean | undefined>(undefined);
  public readonly title = input('Pełna interpretacja Premium');
  public readonly intro = input<string | undefined>(undefined);
  public readonly previewItems = input<string[]>([]);
  public readonly ctaLabel = input('Zobacz rozszerzenie');
  public readonly ctaLink = input('/premium');
  public readonly testId = input('premium-preview-block');
  public readonly ctaClick = output<void>();

  public readonly resolvedHasPremiumContent = computed(() => {
    const explicit = this.hasPremiumContent();
    if (typeof explicit === 'boolean') {
      return explicit;
    }

    return Boolean(this.premiumContent()?.trim());
  });

  public readonly resolvedPreviewItems = computed(() => {
    const items = this.previewItems();
    return items.length > 0 ? items : PREMIUM_PREVIEW_ITEMS[this.variant()];
  });

  public readonly shouldRender = computed(() =>
    this.resolvedHasPremiumContent(),
  );

  public readonly isUnlocked = computed(
    () => this.isPremium() || Boolean(this.premiumContent()?.trim()),
  );

  public onCtaClick(): void {
    this.ctaClick.emit();
  }
}

export type PremiumPreviewVariant =
  | 'horoscope'
  | 'article'
  | 'tarot'
  | 'natal-chart'
  | 'generic';
