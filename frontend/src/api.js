// Клиент API.
// В демо-режиме (VITE_USE_MOCK !== 'false') данные берутся из mockData.js —
// приложение работает без Backend.
// При подключении реального Backend ставим VITE_USE_MOCK=false, и вызовы уходят
// на VITE_API_BASE_URL (см. .env.example).

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

import * as mock from './mockData.js';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Ошибка ${res.status}`);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getRoutes(filters) {
  if (USE_MOCK) return mock.getRoutes(filters);
  const q = new URLSearchParams();
  if (filters.tripType) q.set('trip_type', filters.tripType);
  if (filters.maxDuration) q.set('max_duration', filters.maxDuration);
  if (filters.tags?.length) q.set('tags', filters.tags.join(','));
  return request(`/routes?${q.toString()}`);
}

export async function getRoute(id) {
  if (USE_MOCK) return mock.getRoute(id);
  return request(`/routes/${id}`);
}

export async function getBikes() {
  if (USE_MOCK) return mock.getBikes();
  return request('/bikes');
}

export async function getRental() {
  if (USE_MOCK) return mock.getRental();
  return request('/rental');
}

export async function startRental({ bikeId, routeId }) {
  if (USE_MOCK) return mock.startRental(bikeId, routeId);
  return request('/rental', {
    method: 'POST',
    body: JSON.stringify({ bike_id: bikeId, route_id: routeId }),
  });
}

export async function finishRental() {
  if (USE_MOCK) return mock.finishRental();
  return request('/rental/finish', { method: 'POST' });
}
