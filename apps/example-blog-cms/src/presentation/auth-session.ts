const authTokenStorageKey = "example-blog-cms-auth-token",
  originalFetch = globalThis.fetch.bind(globalThis);

export const readStoredAuthToken = (): string | undefined => {
  if (globalThis.localStorage === undefined) {
    return undefined;
  }
  return globalThis.localStorage.getItem(authTokenStorageKey) ?? undefined;
};

export const storeAuthToken = (token: string): void => {
  globalThis.localStorage?.setItem(authTokenStorageKey, token);
};

/** Adds the development JWT to Management API requests from the dashboard. */
export const installAuthenticatedManagementFetch = (): void => {
  const authenticatedFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let requestUrl: string;
    if (typeof input === "string") {
      requestUrl = input;
    } else if (input instanceof URL) {
      requestUrl = input.href;
    } else {
      requestUrl = input.url;
    }
    const token = readStoredAuthToken();
    if (token !== undefined && requestUrl.includes("/api/v1/management")) {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
  globalThis.fetch = Object.assign(authenticatedFetch, originalFetch);
};

// oxlint-disable-next-line effecttsgo/async-function -- [EH-316] dashboard bootstrap intentionally uses browser fetch before the Management client starts.
export const bootstrapDevelopmentAuthToken = async (cmsBaseUrl: string): Promise<void> => {
  if (readStoredAuthToken() !== undefined) {
    return;
  }
  const response = await originalFetch(`${cmsBaseUrl}/development/token/editor`);
  if (!response.ok) {
    throw new Error(`Failed to bootstrap development auth token (${response.status})`);
  }
  const payload = (await response.json()) as { readonly token?: string };
  if (payload.token === undefined) {
    throw new Error("Development auth token response was missing token");
  }
  storeAuthToken(payload.token);
};
