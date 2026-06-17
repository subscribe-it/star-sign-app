import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ZodiacService } from '../../core/services/zodiac.service';
import { StrapiImagePipe } from '../../core/pipes/strapi-image-pipe';
import { ZodiacSign } from '@star-sign-monorepo/shared-types';

@Component({
  selector: 'app-horoscope',
  imports: [RouterLink, StrapiImagePipe],
  templateUrl: './horoscope.html',
  styleUrl: './horoscope.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Horoscope {
  private readonly zodiacService = inject(ZodiacService);
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);

  public readonly signs = toSignal(
    this.zodiacService.getZodiacSigns().pipe(
      catchError(() => {
        this.error.set('Nie udało się pobrać znaków zodiaku.');
        return of([] as ZodiacSign[]);
      }),
      finalize(() => this.loading.set(false)),
    ),
    {
      initialValue: [] as ZodiacSign[],
    },
  );
}
