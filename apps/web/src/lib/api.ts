import { PaginatedResponse, OverviewStats, Event, Camera, Zone, VirtualLine, AnalyticsRule, User } from './types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
    });
    if (res.status === 401 && typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new ApiError(res.status, error.detail || error.error || 'Request failed');
    }
    if (res.status === 204) return {} as T;
    return res.json();
  }

  async login(email: string, password: string) { return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
  async register(email: string, username: string, password: string) { return this.request('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password }) }); }
  async logout() { return this.request('/auth/logout', { method: 'POST' }); }
  async getMe(): Promise<User> { return this.request('/auth/me'); }
  async refreshToken() { return this.request('/auth/refresh', { method: 'POST' }); }

  async getCameras(page = 1, pageSize = 100): Promise<PaginatedResponse<Camera>> { return this.request(`/cameras?page=${page}&page_size=${pageSize}`); }
  async getCamera(id: string): Promise<Camera> { return this.request(`/cameras/${id}`); }
  async createCamera(data: Partial<Camera>): Promise<Camera> { return this.request('/cameras', { method: 'POST', body: JSON.stringify(data) }); }
  async updateCamera(id: string, data: Partial<Camera>): Promise<Camera> { return this.request(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteCamera(id: string) { return this.request(`/cameras/${id}`, { method: 'DELETE' }); }
  async startCamera(id: string) { return this.request(`/cameras/${id}/start`, { method: 'POST' }); }
  async stopCamera(id: string) { return this.request(`/cameras/${id}/stop`, { method: 'POST' }); }
  async uploadVideo(id: string, file: File) { 
    const formData = new FormData();
    formData.append('file', file);
    return this.request(`/cameras/${id}/upload`, { method: 'POST', body: formData as any }); 
  }

  async getZones(cameraId: string): Promise<Zone[]> { return this.request(`/cameras/${cameraId}/zones`); }
  async createZone(cameraId: string, data: Partial<Zone>): Promise<Zone> { return this.request(`/cameras/${cameraId}/zones`, { method: 'POST', body: JSON.stringify(data) }); }
  async updateZone(cameraId: string, zoneId: string, data: Partial<Zone>): Promise<Zone> { return this.request(`/cameras/${cameraId}/zones/${zoneId}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteZone(cameraId: string, zoneId: string) { return this.request(`/cameras/${cameraId}/zones/${zoneId}`, { method: 'DELETE' }); }

  async getLines(cameraId: string): Promise<VirtualLine[]> { return this.request(`/cameras/${cameraId}/lines`); }
  async createLine(cameraId: string, data: Partial<VirtualLine>): Promise<VirtualLine> { return this.request(`/cameras/${cameraId}/lines`, { method: 'POST', body: JSON.stringify(data) }); }
  async updateLine(cameraId: string, lineId: string, data: Partial<VirtualLine>): Promise<VirtualLine> { return this.request(`/cameras/${cameraId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteLine(cameraId: string, lineId: string) { return this.request(`/cameras/${cameraId}/lines/${lineId}`, { method: 'DELETE' }); }

  async getRules(cameraId: string): Promise<AnalyticsRule[]> { return this.request(`/cameras/${cameraId}/rules`); }
  async createRule(cameraId: string, data: Partial<AnalyticsRule>): Promise<AnalyticsRule> { return this.request(`/cameras/${cameraId}/rules`, { method: 'POST', body: JSON.stringify(data) }); }
  async updateRule(cameraId: string, ruleId: string, data: Partial<AnalyticsRule>): Promise<AnalyticsRule> { return this.request(`/cameras/${cameraId}/rules/${ruleId}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteRule(cameraId: string, ruleId: string) { return this.request(`/cameras/${cameraId}/rules/${ruleId}`, { method: 'DELETE' }); }

  async getEvents(filters?: any): Promise<PaginatedResponse<Event>> {
    const qs = filters ? new URLSearchParams(filters).toString() : '';
    return this.request(`/events${qs ? '?' + qs : ''}`);
  }
  async getEvent(id: string): Promise<Event> { return this.request(`/events/${id}`); }
  async updateEventStatus(id: string, status: string): Promise<Event> { return this.request(`/events/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
  async exportEvents(filters: { format?: 'csv' | 'json'; camera_id?: string; severity?: string; event_type?: string; status?: string } = {}): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.format) params.append('format', filters.format);
    if (filters.camera_id) params.append('camera_id', filters.camera_id);
    if (filters.severity && filters.severity !== 'all') params.append('severity', filters.severity);
    if (filters.event_type) params.append('event_type', filters.event_type);
    if (filters.status) params.append('status', filters.status);

    const res = await fetch(`${API_BASE}/events/export?${params.toString()}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to export events');
    return res.blob();
  }

  async getOverview(): Promise<OverviewStats> { return this.request('/analytics/overview'); }
  async getTimeseries(params?: any): Promise<{period: string; count: number}[]> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/analytics/timeseries${qs ? '?' + qs : ''}`);
  }
  async getDistribution(params?: any): Promise<Record<string, number>> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/analytics/distribution${qs ? '?' + qs : ''}`);
  }

  async getHealth(): Promise<any> { return this.request('/system/health'); }
  async getMetrics(): Promise<any> { return this.request('/system/metrics'); }
}

export const api = new ApiClient();
