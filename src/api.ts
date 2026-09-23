export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export class ApiClient {
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`/api/${path}`, {method, credentials:'same-origin', headers:body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body) : undefined});
    let data: { error?: string } | T = {};
    try {
      data = await response.json() as T | { error?: string };
    } catch {
      if (!response.ok) throw new ApiError('Falha ao acessar o servidor.', response.status);
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('zeus:unauthorized'))
    }
    if (!response.ok) throw new ApiError((data as { error?: string }).error ?? 'Falha ao acessar o servidor.', response.status);
    return data as T;
  }
}
export const api = new ApiClient();
