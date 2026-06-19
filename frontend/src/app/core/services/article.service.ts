import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { StrapiCollectionResponse } from '@star-sign-monorepo/shared-types';
import { Article } from '@star-sign-monorepo/shared-types';
import { API_REQUEST_TIMEOUT_MS } from './api-timeout';

@Injectable({
  providedIn: 'root',
})
export class ArticleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  public getArticles(
    page = 1,
    pageSize = 12,
    category?: string,
    search?: string,
  ): Observable<StrapiCollectionResponse<Article>> {
    let url = `${this.apiUrl}/articles?sort=publishedAt:desc&pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate[0]=category&populate[1]=image`;

    if (category && category !== 'Wszystko') {
      url += `&filters[category][name][$eq]=${encodeURIComponent(category)}`;
    }

    if (search && search.trim() !== '') {
      url += `&filters[$or][0][title][$containsi]=${encodeURIComponent(search)}&filters[$or][1][excerpt][$containsi]=${encodeURIComponent(search)}`;
    }

    return this.http.get<StrapiCollectionResponse<Article>>(url).pipe(
      timeout(API_REQUEST_TIMEOUT_MS),
      catchError(() =>
        of({
          data: [],
          meta: {
            pagination: { page: 1, pageSize: 12, pageCount: 0, total: 0 },
          },
        }),
      ),
    );
  }

  public getRecentArticles(limit = 3): Observable<Article[]> {
    return this.http
      .get<
        StrapiCollectionResponse<Article>
      >(`${this.apiUrl}/articles?sort=publishedAt:desc&pagination[limit]=${limit}&populate[0]=category&populate[1]=image`)
      .pipe(
        timeout(API_REQUEST_TIMEOUT_MS),
        map((response) => response.data),
        catchError(() => of([])),
      );
  }

  public getArticleBySlug(slug: string): Observable<Article | undefined> {
    return this.http
      .get<
        StrapiCollectionResponse<Article>
      >(`${this.apiUrl}/articles?filters[slug][$eq]=${encodeURIComponent(slug)}&populate[0]=category&populate[1]=image&populate[2]=editor_persona`)
      .pipe(
        timeout(API_REQUEST_TIMEOUT_MS),
        map((response) => response.data[0]),
        catchError(() => of(undefined)),
      );
  }

  /**
   * Recent articles attributed to a given editor persona (author), newest
   * first. Used by the public author page. Empty array on any error.
   */
  public getArticlesByPersonaKey(
    personaKey: string,
    limit = 6,
  ): Observable<Article[]> {
    const url = `${this.apiUrl}/articles?filters[editor_persona][key][$eq]=${encodeURIComponent(personaKey)}&sort=publishedAt:desc&pagination[limit]=${limit}&populate[0]=category&populate[1]=image`;
    return this.http.get<StrapiCollectionResponse<Article>>(url).pipe(
      timeout(API_REQUEST_TIMEOUT_MS),
      map((response) => response.data),
      catchError(() => of([])),
    );
  }

  public getRelatedArticles(
    categoryName: string,
    currentSlug: string,
    limit = 3,
  ): Observable<Article[]> {
    const url = `${this.apiUrl}/articles?filters[category][name][$eq]=${encodeURIComponent(categoryName)}&filters[slug][$ne]=${encodeURIComponent(currentSlug)}&pagination[limit]=${limit}&populate[0]=category&populate[1]=image`;
    return this.http.get<StrapiCollectionResponse<Article>>(url).pipe(
      timeout(API_REQUEST_TIMEOUT_MS),
      map((response) => response.data),
      catchError(() => of([])),
    );
  }
}
