import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './apiClient';

describe('apiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('performs GET request and parses JSON response', async () => {
    const mockData = { id: 1, name: 'Monza' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const data = await api.get('/api/tracks', { params: { search: 'monza', limit: 10 } });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tracks?search=monza&limit=10', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Accept: 'application/json' }),
    }));
    expect(data).toEqual(mockData);
  });

  it('accepts an AbortSignal directly as second argument', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
    });

    await api.get('/api/status', controller.signal);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/status', expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it('handles 204 No Content gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const result = await api.get('/api/empty');
    expect(result).toBeUndefined();
  });

  it('handles non-JSON text response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'hello world',
    });

    const result = await api.get('/api/plain');
    expect(result).toBe('hello world');
  });

  it('throws ApiError on HTTP error with JSON message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Invalid session ID' }),
    });

    await expect(api.get('/api/sessions/abc')).rejects.toThrow(ApiError);
    await expect(api.get('/api/sessions/abc')).rejects.toMatchObject({
      message: 'Invalid session ID',
      status: 400,
      statusText: 'Bad Request',
      body: { message: 'Invalid session ID' },
    });
  });

  it('throws ApiError on HTTP error with text body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'Database failure',
    });

    await expect(api.get('/api/error')).rejects.toThrow(ApiError);
    await expect(api.get('/api/error')).rejects.toMatchObject({
      message: 'Database failure',
      status: 500,
      statusText: 'Internal Server Error',
    });
  });

  it('performs POST request with JSON payload', async () => {
    const payload = { tag_name: 'Fast Lap' };
    const responseData = { id: 42, ...payload };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => responseData,
    });

    const result = await api.post('/api/tags', payload);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tags', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }));
    expect(result).toEqual(responseData);
  });

  it('performs PUT and DELETE requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ deleted: true }),
    });

    await api.put('/api/tags/1', { name: 'Updated' });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tags/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    }));

    await api.del('/api/tags/1', { force: true });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tags/1', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ force: true }),
    }));
  });

  it('performs postFormData for uploads', async () => {
    const formData = new FormData();
    formData.append('file', 'test-data');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ imported: 1 }),
    });

    const result = await api.postFormData('/api/sessions/import', formData);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/import', expect.objectContaining({
      method: 'POST',
      body: formData,
    }));
    expect(result).toEqual({ imported: 1 });
  });

  it('fetches binary blob using getBlob and postBlob', async () => {
    const mockBlob = new Blob(['test-binary-data'], { type: 'application/octet-stream' });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: async () => mockBlob,
    });

    const blob = await api.getBlob('/api/sessions/1/export');
    expect(blob).toBe(mockBlob);

    const postBlobResult = await api.postBlob('/api/sessions/export-batch', { session_ids: [1, 2] });
    expect(postBlobResult).toBe(mockBlob);
  });

  it('fetches ArrayBuffer with postArrayBuffer', async () => {
    const mockBuffer = new ArrayBuffer(8);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => mockBuffer,
    });

    const buffer = await api.postArrayBuffer('/api/ai/tts', { text: 'Box box' });
    expect(buffer).toBe(mockBuffer);
  });

  it('initiates streaming request with stream()', async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const streamRes = await api.stream('/api/ai/chat', { prompt: 'How are tyres?' });
    expect(streamRes).toBe(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Accept: 'text/event-stream, application/json' }),
    }));
  });
});
