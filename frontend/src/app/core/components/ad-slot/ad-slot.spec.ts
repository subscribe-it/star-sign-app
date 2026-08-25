import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdSlotComponent } from './ad-slot';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';

type SetupOptions = {
  clientId?: string;
  marketing?: boolean;
};

const setup = async (
  options: SetupOptions = {},
): Promise<ComponentFixture<AdSlotComponent>> => {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [AdSlotComponent],
    providers: [
      {
        provide: RuntimeConfigService,
        useValue: { adsenseClientId: () => options.clientId ?? '' },
      },
      {
        provide: CookieConsentService,
        useValue: { marketingAllowed: () => options.marketing ?? false },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdSlotComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
};

const flushFrames = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('AdSlot', () => {
  afterEach(() => {
    document.getElementById('adsbygoogle-js')?.remove();
    vi.restoreAllMocks();
  });

  it('renders the placeholder when no publisher id is configured', async () => {
    const fixture = await setup({ clientId: '', marketing: true });
    fixture.componentRef.setInput('placeholderTitle', 'Odkryj Magiczne Amulety');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Reklama');
    expect(host.textContent).toContain('Odkryj Magiczne Amulety');
    expect(host.querySelector('ins.adsbygoogle')).toBeNull();
    expect(document.getElementById('adsbygoogle-js')).toBeNull();
  });

  it('renders the placeholder until marketing consent is granted', async () => {
    const fixture = await setup({
      clientId: 'ca-pub-1234567890123456',
      marketing: false,
    });

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('ins.adsbygoogle'),
    ).toBeNull();
  });

  it('loads AdSense once and queues the unit when active', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild');
    const first = await setup({
      clientId: 'ca-pub-1234567890123456',
      marketing: true,
    });

    expect(
      (first.nativeElement as HTMLElement).querySelector('ins.adsbygoogle'),
    ).not.toBeNull();
    expect(document.getElementById('adsbygoogle-js')).not.toBeNull();
    expect(appendSpy).toHaveBeenCalledTimes(1);

    await flushFrames();
    expect(Array.isArray(window.adsbygoogle)).toBe(true);
    expect((window.adsbygoogle as unknown[]).length).toBeGreaterThan(0);

    // Druga instancja: skrypt nie jest dołączany ponownie (guard po id).
    const second = await setup({
      clientId: 'ca-pub-1234567890123456',
      marketing: true,
    });
    expect(
      (second.nativeElement as HTMLElement).querySelector('ins.adsbygoogle'),
    ).not.toBeNull();
    expect(appendSpy).toHaveBeenCalledTimes(1);
  });
});
