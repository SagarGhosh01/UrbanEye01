import { User, State, District, RoadEvent, BusSession, AnalyticsStats, EventStatus, NationalSummaryResponse, StateSummaryResponse } from '../types';

const getApiBase = (): string => {
  try {
    const envUrl = (((import.meta as any).env?.VITE_API_URL) as string) || '';
    if (envUrl) {
      return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
    }
  } catch {
    // fallback to relative endpoint
  }
  return '/api';
};

const API_BASE = getApiBase();

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('urbaneye_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if ((res.status === 502 || res.status === 503 || res.status === 504) && i < retries - 1) {
        console.warn(`[Render Cold-Start Retry ${i + 1}/${retries}] HTTP ${res.status}. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
        continue;
      }
      return res;
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`[Render Connection Retry ${i + 1}/${retries}] Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
      } else {
        throw err;
      }
    }
  }
  return fetch(url, options);
}

export const api = {
  // Auth
  async login(email: string, password: string):Promise<{ token: string; user: User }> {
    const res = await fetchWithRetry(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Authentication failed');
    }
    return res.json();
  },

  async getMe(): Promise<User> {
    const res = await fetchWithRetry(`${API_BASE}/auth/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Session expired or unauthorized');
    return res.json();
  },

  // Geography
  async getStates(): Promise<State[]> {
    const res = await fetchWithRetry(`${API_BASE}/geography/states`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load states');
    return res.json();
  },

  async getDistricts(stateId: string): Promise<District[]> {
    const res = await fetchWithRetry(`${API_BASE}/geography/states/${stateId}/districts`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load districts');
    return res.json();
  },

  async getDistrict(districtId: string): Promise<District> {
    const res = await fetchWithRetry(`${API_BASE}/geography/districts/${districtId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load district details');
    return res.json();
  },

  async getNationalSummary(): Promise<NationalSummaryResponse> {
    const res = await fetchWithRetry(`${API_BASE}/geography/national/summary`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load national summary');
    return res.json();
  },

  async getStateSummary(stateId: string): Promise<StateSummaryResponse> {
    const res = await fetchWithRetry(`${API_BASE}/geography/states/${stateId}/summary`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load state summary');
    return res.json();
  },

  // Events
  async getEvents(params: {
    districtId?: string;
    type?: string;
    status?: string;
    busLabel?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ totalCount: number; limit: number; offset: number; events: RoadEvent[] }> {
    const query = new URLSearchParams();
    if (params.districtId) query.set('districtId', params.districtId);
    if (params.type) query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.busLabel) query.set('busLabel', params.busLabel);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());

    const res = await fetchWithRetry(`${API_BASE}/events?${query.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch road events');
    return res.json();
  },

  async submitCitizenReport(data: {
    imageSnippet: string;
    latitude: number;
    longitude: number;
    districtId?: string;
    manualLocationName?: string;
    type?: string;
  }): Promise<{ success: boolean; noDefect?: boolean; message?: string; event?: RoadEvent }> {
    const res = await fetchWithRetry(`${API_BASE}/events/citizen-report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Submission failed' }));
      throw new Error(err.error || 'Failed to submit citizen defect report');
    }
    return res.json();
  },

  async getMyCitizenReports(): Promise<{ success: boolean; count: number; reports: RoadEvent[] }> {
    const res = await fetchWithRetry(`${API_BASE}/events/my-reports`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch citizen report history');
    return res.json();
  },

  async updateEventStatus(
    eventId: string,
    status: EventStatus,
    reviewNotes?: string
  ): Promise<{ success: boolean; event: RoadEvent }> {
    const res = await fetchWithRetry(`${API_BASE}/events/${eventId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, reviewNotes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(err.error || 'Failed to update event status');
    }
    return res.json();
  },

  async deleteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/events/${eventId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Failed to delete defect event');
    }
    return res.json();
  },

  async purgeEvents(districtId?: string): Promise<{ success: boolean; message: string; deletedCount: number }> {
    const query = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
    const res = await fetchWithRetry(`${API_BASE}/events/purge${query}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Purge failed' }));
      throw new Error(err.error || 'Failed to purge defect events');
    }
    return res.json();
  },

  async getEventStats(districtId?: string): Promise<AnalyticsStats> {
    const query = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
    const res = await fetchWithRetry(`${API_BASE}/events/stats${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load analytics statistics');
    return res.json();
  },

  // Bus Pairing
  async confirmPairing(data: {
    pin: string;
    busLabel: string;
    routeTag?: string;
    targetDistrictId?: string;
  }): Promise<{ success: boolean; message: string; session: BusSession }> {
    const res = await fetchWithRetry(`${API_BASE}/pairing/confirm`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Pairing failed' }));
      throw new Error(err.error || 'PIN pairing failed');
    }
    return res.json();
  },

  async getBusSessions(districtId?: string): Promise<BusSession[]> {
    const query = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
    const res = await fetchWithRetry(`${API_BASE}/pairing/sessions${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bus sessions');
    return res.json();
  },

  async unpairBusSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/pairing/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unpair failed' }));
      throw new Error(err.error || 'Failed to unpair bus session');
    }
    return res.json();
  },

  // Generic HTTP helpers

  async get(url: string, options?: { params?: Record<string, any> }) {
    let fullUrl = `${API_BASE}${url}`;
    if (options?.params) {
      const q = new URLSearchParams();
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) q.set(k, String(v));
      });
      const qStr = q.toString();
      if (qStr) fullUrl += `?${qStr}`;
    }
    const res = await fetchWithRetry(fullUrl, { headers: getHeaders() });
    if (!res.ok) throw new Error(`GET ${url} failed`);
    return { data: await res.json() };
  },

  async post(url: string, body?: any) {
    const res = await fetchWithRetry(`${API_BASE}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${url} failed`);
    return { data: await res.json() };
  },

  async patch(url: string, body?: any) {
    const res = await fetchWithRetry(`${API_BASE}${url}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`PATCH ${url} failed`);
    return { data: await res.json() };
  },

  async del(url: string) {
    const res = await fetchWithRetry(`${API_BASE}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE ${url} failed`);
    return { data: await res.json() };
  },
};

