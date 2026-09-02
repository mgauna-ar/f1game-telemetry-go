/**
 * Centralized, typed, zero-dependency HTTP client for all frontend API interactions.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body?: unknown;

  constructor(message: string, status: number, statusText: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  params?: Record<string, string | number | boolean | undefined | null>;
}

type OptionsOrSignal = RequestOptions | AbortSignal;

function normalizeOptions(optionsOrSignal?: OptionsOrSignal): RequestOptions {
  if (!optionsOrSignal) return {};
  if (typeof (optionsOrSignal as AbortSignal).aborted === 'boolean') {
    return { signal: optionsOrSignal as AbortSignal };
  }
  return optionsOrSignal as RequestOptions;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return path;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  if (!queryString) return path;
  return path.includes('?') ? `${path}&${queryString}` : `${path}?${queryString}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorBody: unknown = undefined;
    let errorMessage = `HTTP ${res.status}: ${res.statusText || 'Error'}`;

    try {
      if (res.headers && typeof res.headers.get === 'function') {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json') && typeof res.json === 'function') {
          errorBody = await res.json();
          if (typeof errorBody === 'object' && errorBody !== null) {
            const bodyObj = errorBody as Record<string, unknown>;
            if (typeof bodyObj.message === 'string') {
              errorMessage = bodyObj.message;
            } else if (typeof bodyObj.error === 'string') {
              errorMessage = bodyObj.error;
            }
          }
        } else if (typeof res.text === 'function') {
          const text = await res.text();
          if (text) {
            errorMessage = text;
            errorBody = text;
          }
        }
      } else if (typeof res.json === 'function') {
        errorBody = await res.json();
        if (typeof errorBody === 'object' && errorBody !== null) {
          const bodyObj = errorBody as Record<string, unknown>;
          if (typeof bodyObj.message === 'string') {
            errorMessage = bodyObj.message;
          } else if (typeof bodyObj.error === 'string') {
            errorMessage = bodyObj.error;
          }
        }
      } else if (typeof res.text === 'function') {
        const text = await res.text();
        if (text) {
          errorMessage = text;
          errorBody = text;
        }
      }
    } catch {
      // Ignore parse failure on error body
    }

    throw new ApiError(errorMessage, res.status, res.statusText || '', errorBody);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (res.headers && typeof res.headers.get === 'function') {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json') && typeof res.json === 'function') {
      return (await res.json()) as T;
    }
    if (contentType.includes('text/') && typeof res.text === 'function') {
      return (await res.text()) as unknown as T;
    }
  }

  if (typeof res.json === 'function') {
    try {
      return (await res.json()) as T;
    } catch {
      // Fall through to text
    }
  }

  if (typeof res.text === 'function') {
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  return undefined as unknown as T;
}

export const api = {
  /**
   * Performs a typed GET request.
   */
  async get<T = unknown>(path: string, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      ...rest,
    });

    return handleResponse<T>(res);
  },

  /**
   * Performs a typed POST request with a JSON payload.
   */
  async post<T = unknown>(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    return handleResponse<T>(res);
  },

  /**
   * Performs a typed PUT request with a JSON payload.
   */
  async put<T = unknown>(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    return handleResponse<T>(res);
  },

  /**
   * Performs a typed DELETE request with an optional JSON body.
   */
  async del<T = unknown>(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    return handleResponse<T>(res);
  },

  /**
   * Performs a multipart/form-data POST request for file uploads and imports.
   */
  async postFormData<T = unknown>(path: string, formData: FormData, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body: formData,
      ...rest,
    });

    return handleResponse<T>(res);
  },

  /**
   * Fetches binary data as a Blob (e.g. session export downloads).
   */
  async getBlob(path: string, optionsOrSignal?: OptionsOrSignal): Promise<Blob> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'GET',
      headers,
      ...rest,
    });

    if (!res.ok) {
      const errText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      throw new ApiError(errText || `HTTP ${res.status}`, res.status, res.statusText || '');
    }

    return typeof res.blob === 'function' ? res.blob() : (res as unknown as Blob);
  },

  /**
   * Posts data and receives a binary Blob response (e.g. batch export zip).
   */
  async postBlob(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<Blob> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    if (!res.ok) {
      const errText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      throw new ApiError(errText || `HTTP ${res.status}`, res.status, res.statusText || '');
    }

    return typeof res.blob === 'function' ? res.blob() : (res as unknown as Blob);
  },

  /**
   * Posts data and receives an ArrayBuffer (e.g. neural TTS audio binary).
   */
  async postArrayBuffer(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<ArrayBuffer> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    if (!res.ok) {
      const errText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      throw new ApiError(errText || `HTTP ${res.status}`, res.status, res.statusText || '');
    }

    return typeof res.arrayBuffer === 'function' ? res.arrayBuffer() : (res as unknown as ArrayBuffer);
  },

  /**
   * Initiates an SSE / streaming POST request returning the raw Response.
   */
  async stream(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<Response> {
    const opts = normalizeOptions(optionsOrSignal);
    const { params, headers, ...rest } = opts;
    const url = buildUrl(path, params);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });

    return res;
  },
};
