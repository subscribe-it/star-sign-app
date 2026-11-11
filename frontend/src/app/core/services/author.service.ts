import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

/**
 * Public, audience-facing author used on the public author page. Serwis nie
 * wykonuje żadnych zapytań HTTP i zwraca wyłącznie redakcję Star Sign.
 */
export interface PublicAuthor {
  key: string;
  byline?: string | null;
  bio?: string | null;
  specialization?: string | null;
  avatar?: {
    url: string;
    alternativeText?: string | null;
  } | null;
}

export const FALLBACK_AUTHOR: PublicAuthor = {
  key: 'redakcja-star-sign',
  byline: 'Redakcja Star Sign',
  bio: 'Zespół redakcyjny Star Sign.',
  specialization: 'Astrologia, tarot i numerologia',
  avatar: null,
};

@Injectable({
  providedIn: 'root',
})
export class AuthorService {
  public getAuthors(): Observable<PublicAuthor[]> {
    return of([FALLBACK_AUTHOR]);
  }

  /** Only the editorial fallback author exists; any other key is "not found". */
  public getAuthorByKey(key: string): Observable<PublicAuthor | undefined> {
    return of(
      key?.trim() === FALLBACK_AUTHOR.key ? FALLBACK_AUTHOR : undefined,
    );
  }
}
