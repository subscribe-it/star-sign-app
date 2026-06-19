import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { API_REQUEST_TIMEOUT_MS } from './api-timeout';

/**
 * Public, audience-facing author (editor persona) used for E-E-A-T authorship
 * on the public site. Mirrors the safe fields returned by the AICO plugin's
 * public personas endpoint — never any LLM internals.
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

type AuthorResponse<T> = { data: T };

/**
 * Reads public author (editor persona) data from the AI Content Orchestrator
 * plugin's read-only content-api. Plugin content-api routes are mounted under
 * /api/<plugin-id>/..., hence the ai-content-orchestrator prefix.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthorService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-content-orchestrator/editor-personas`;

  /** Active authors (safe fields only). Empty array on any error. */
  public getAuthors(): Observable<PublicAuthor[]> {
    return this.http.get<AuthorResponse<PublicAuthor[]>>(this.baseUrl).pipe(
      timeout(API_REQUEST_TIMEOUT_MS),
      map((response) => response.data ?? []),
      catchError(() => of([] as PublicAuthor[])),
    );
  }

  /** Single author by key. Returns undefined when missing/inactive or on error. */
  public getAuthorByKey(key: string): Observable<PublicAuthor | undefined> {
    const trimmed = key?.trim();
    if (!trimmed) {
      return of(undefined);
    }

    return this.http
      .get<
        AuthorResponse<PublicAuthor>
      >(`${this.baseUrl}/${encodeURIComponent(trimmed)}`)
      .pipe(
        timeout(API_REQUEST_TIMEOUT_MS),
        map((response) => response.data ?? undefined),
        catchError(() => of(undefined)),
      );
  }
}
