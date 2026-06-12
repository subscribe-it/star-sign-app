import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Footer } from './footer';
import { RouterTestingModule } from '@angular/router/testing';
import { CookieConsentService } from '../../services/cookie-consent.service';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have current year', () => {
    expect(component.currentYear).toBe(new Date().getFullYear());
  });

  it('should reopen the cookie consent banner from "Zarządzaj zgodami"', () => {
    const trigger = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('[data-test="manage-cookie-consent"]');

    expect(trigger?.textContent).toContain('Zarządzaj zgodami');
    trigger?.click();

    const consentService = TestBed.inject(CookieConsentService);
    expect(consentService.bannerVisible()).toBe(true);
  });

  it('should have links defined', () => {
    expect(component.navLinks.length).toBeGreaterThan(0);
    expect(component.socials.length).toBe(0);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('a[href="#"]'),
    ).toBeNull();
  });
});
