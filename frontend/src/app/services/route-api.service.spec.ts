import { RouteApiService } from './route-api.service';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('RouteApiService', () => {
  let api: RouteApiService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    api = new RouteApiService();
    fetchSpy = spyOn(window, 'fetch');
    // don't actually wait between retries
    spyOn(api as any, 'sleep').and.returnValue(Promise.resolve());
  });

  it('returns the body of a successful response', async () => {
    fetchSpy.and.resolveTo(jsonResponse(200, { status: 'success' }));

    const result = await api.parseRouteFile('1,2;3,4', 'array');

    expect(result).toEqual({ status: 'success' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries once when the elevation service is unavailable', async () => {
    fetchSpy.and.returnValues(
      Promise.resolve(
        jsonResponse(
          503,
          { message: 'nicht verfügbar' },
          { 'Retry-After': '5' },
        ),
      ),
      Promise.resolve(jsonResponse(200, { status: 'success' })),
    );

    const result = await api.parseRouteFile('1,2;3,4', 'array');

    expect(result).toEqual({ status: 'success' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect((api as any).sleep).toHaveBeenCalledWith(5_000);
  });

  it('throws the backend message once retries are exhausted', async () => {
    fetchSpy.and.callFake(() =>
      Promise.resolve(jsonResponse(503, { message: 'Höhendaten fehlen' })),
    );

    await expectAsync(
      api.parseRouteFile('1,2;3,4', 'array'),
    ).toBeRejectedWithError('Höhendaten fehlen');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry server errors that are not temporary', async () => {
    fetchSpy.and.resolveTo(jsonResponse(500, { message: 'kaputt' }));

    await expectAsync(
      api.parseRouteFile('1,2;3,4', 'array'),
    ).toBeRejectedWithError('kaputt');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and then reports them readably', async () => {
    fetchSpy.and.rejectWith(new TypeError('Failed to fetch'));

    await expectAsync(
      api.parseRouteFile('1,2;3,4', 'array'),
    ).toBeRejectedWithError(/nicht erreichbar/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
