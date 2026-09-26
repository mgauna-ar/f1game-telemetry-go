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

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestInitParts {
  method: Method;
  /** JSON-encoded unless it is FormData, which the browser encodes itself. */
  body?: unknown;
  accept?: string;
}

/**
 * Sends one request. Every method goes through here, so every non-OK response
 * is turned into an ApiError the same way (except stream(), see below).
 */
async function send(path: string, { method, body, accept }: RequestInitParts, optionsOrSignal?: OptionsOrSignal): Promise<Response> {
  const { params, headers, ...rest } = normalizeOptions(optionsOrSignal);
  const isFormData = body instanceof FormData;
  const hasJsonBody = body !== undefined && !isFormData;

  return fetch(buildUrl(path, params), {
    method,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(accept ? { Accept: accept } : {}),
      ...headers,
    },
    body: isFormData ? body : hasJsonBody ? JSON.stringify(body) : undefined,
    ...rest,
  });
}

async function request(path: string, init: RequestInitParts, optionsOrSignal?: OptionsOrSignal): Promise<Response> {
  const res = await send(path, init, optionsOrSignal);
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return res;
}

/**
 * Reads a body by its content type. Responses without one (minimal test mocks
 * that have no headers) are read as JSON when possible, otherwise as text.
 */
async function readBody(res: Response): Promise<unknown> {
  const contentType = res.headers?.get?.('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  if (contentType.includes('text/') || typeof res.json !== 'function') {
    if (typeof res.text !== 'function') return undefined;
    const text = await res.text();
    if (contentType.includes('text/')) return text;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return res.json();
}

function messageFromBody(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return body || undefined;
  }
  if (typeof body === 'object' && body !== null) {
    const { message, error } = body as Record<string, unknown>;
    if (typeof message === 'string' && message) return message;
    if (typeof error === 'string' && error) return error;
  }
  return undefined;
}

/**
 * Builds an ApiError from a non-OK response. The server's JSON errors are
 * {"error": "...", "code": "..."}; their text becomes the error message.
 */
async function parseErrorResponse(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await readBody(res);
  } catch {
    body = undefined;
  }
  const message = messageFromBody(body) ?? `HTTP ${res.status}: ${res.statusText || 'Error'}`;
  return new ApiError(message, res.status, res.statusText || '', body);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  return (await readBody(res)) as T;
}

export const api = {
  /**
   * Performs a typed GET request.
   */
  async get<T = unknown>(path: string, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    return parseJson<T>(await request(path, { method: 'GET', accept: 'application/json' }, optionsOrSignal));
  },

  /**
   * Performs a typed POST request with a JSON payload.
   */
  async post<T = unknown>(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    return parseJson<T>(await request(path, { method: 'POST', body, accept: 'application/json' }, optionsOrSignal));
  },

  /**
   * Performs a typed PUT request with a JSON payload.
   */
  async put<T = unknown>(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    return parseJson<T>(await request(path, { method: 'PUT', body, accept: 'application/json' }, optionsOrSignal));
  },

  /**
   * Performs a typed DELETE request with an optional JSON body.
   */
  async del<T = unknown>(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    return parseJson<T>(await request(path, { method: 'DELETE', body, accept: 'application/json' }, optionsOrSignal));
  },

  /**
   * Performs a multipart/form-data POST request for file uploads and imports.
   */
  async postFormData<T = unknown>(path: string, formData: FormData, optionsOrSignal?: OptionsOrSignal): Promise<T> {
    return parseJson<T>(await request(path, { method: 'POST', body: formData, accept: 'application/json' }, optionsOrSignal));
  },

  /**
   * Fetches binary data as a Blob (e.g. session export downloads).
   */
  async getBlob(path: string, optionsOrSignal?: OptionsOrSignal): Promise<Blob> {
    return (await request(path, { method: 'GET' }, optionsOrSignal)).blob();
  },

  /**
   * Posts data and receives a binary Blob response (e.g. batch export zip).
   */
  async postBlob(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<Blob> {
    return (await request(path, { method: 'POST', body }, optionsOrSignal)).blob();
  },

  /**
   * Posts data and receives an ArrayBuffer (e.g. neural TTS audio binary).
   */
  async postArrayBuffer(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<ArrayBuffer> {
    return (await request(path, { method: 'POST', body }, optionsOrSignal)).arrayBuffer();
  },

  /**
   * Initiates an SSE / streaming POST request returning the raw Response, OK or not:
   * the chat-stream readers in sseUtils.ts read both the stream and non-OK error bodies.
   */
  async stream(path: string, body?: unknown, optionsOrSignal?: OptionsOrSignal): Promise<Response> {
    return send(path, { method: 'POST', body, accept: 'text/event-stream, application/json' }, optionsOrSignal);
  },
};
