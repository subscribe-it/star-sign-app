import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZodiacProfile } from './zodiac-profile';
import { ZodiacService } from '../../core/services/zodiac.service';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';

describe('ZodiacProfile', () => {
  let component: ZodiacProfile;
  let fixture: ComponentFixture<ZodiacProfile>;
  let zodiacService: any;
  let activatedRoute: any;

  const mockSigns = [
    { name: 'Baran', slug: 'baran', image: { url: '/image.png' } },
    { name: 'Byk', slug: 'byk' },
  ];

  beforeEach(async () => {
    zodiacService = {
      getZodiacSigns: vi.fn().mockReturnValue(of(mockSigns)),
    };

    activatedRoute = {
      paramMap: of(convertToParamMap({ sign: 'baran' })),
    };

    await TestBed.configureTestingModule({
      imports: [ZodiacProfile, RouterTestingModule],
      providers: [
        { provide: ZodiacService, useValue: zodiacService },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ZodiacProfile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load sign based on route parameter', () => {
    expect(zodiacService.getZodiacSigns).toHaveBeenCalled();
    expect(component.sign()?.slug).toBe('baran');
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should render the sign image across the profile elements', () => {
    const images = fixture.nativeElement.querySelectorAll(
      'img[alt*="Baran"]',
    ) as NodeListOf<HTMLImageElement>;

    expect(images.length).toBeGreaterThan(1);
  });

  it('should set error if sign not found', () => {
    activatedRoute.paramMap = of(convertToParamMap({ sign: 'nie-istnieje' }));
    // We need to re-initialize or trigger the switchMap
    fixture = TestBed.createComponent(ZodiacProfile);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.sign()).toBeUndefined();
    expect(component.error()).toContain('nie został znaleziony');
  });

  it('should handle service error', () => {
    zodiacService.getZodiacSigns.mockReturnValue(
      throwError(() => new Error('API Error')),
    );
    fixture = TestBed.createComponent(ZodiacProfile);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toContain('problem podczas pobierania danych');
    expect(component.isLoading()).toBe(false);
  });
});
