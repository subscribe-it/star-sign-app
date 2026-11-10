import { firstValueFrom } from 'rxjs';
import { AuthorService, FALLBACK_AUTHOR } from './author.service';

describe('AuthorService', () => {
  const service = new AuthorService();

  it('returns only the fallback author list (no HTTP)', async () => {
    expect(await firstValueFrom(service.getAuthors())).toEqual([
      FALLBACK_AUTHOR,
    ]);
  });

  it('resolves the fallback author key', async () => {
    expect(
      await firstValueFrom(service.getAuthorByKey(FALLBACK_AUTHOR.key)),
    ).toEqual(FALLBACK_AUTHOR);
  });

  it('returns undefined for unknown or empty keys', async () => {
    expect(
      await firstValueFrom(service.getAuthorByKey('nieznany')),
    ).toBeUndefined();
    expect(await firstValueFrom(service.getAuthorByKey(''))).toBeUndefined();
  });
});
