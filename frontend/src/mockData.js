import catalog from '../../data/routes_kazan.json';

export const ROUTES = catalog.map(route => ({
  ...route,
  id: route.id === 'r-les-kazani' ? 'r1' : route.id,
  distanceKm: route._lengthKm,
}));

// Велосипеды стоят у общей точки старта (предложение из плана).
const BIKES = [
  { id: 'b1', label: 'Велосипед A', status: 'available', coords: [49.1048, 55.7972] },
  { id: 'b2', label: 'Велосипед B', status: 'busy', coords: [49.1053, 55.797] },
  { id: 'b3', label: 'Велосипед C', status: 'available', coords: [49.105, 55.7965] },
];

const STORAGE_KEY = 'put-rental-demo';

function readRental() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}
function writeRental(rental) {
  if (rental === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(rental));
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function filterRoutes(filters) {
  const { tripType, maxDuration, tags = [] } = filters;
  return ROUTES.filter((route) => {
    if (tripType && tripType !== 'любой' && !route.categories.includes(tripType)) return false;
    if (maxDuration && route.durationMin > maxDuration) return false;
    if (tags.length && !tags.some((t) => route.tags.includes(t))) return false;
    return true;
  });
}

export async function getRoutes(filters) {
  await delay(300);
  // Как и реальный Backend, список отдаётся БЕЗ геометрии (только карточки).
  return filterRoutes(filters).map(({ geometry, description, verified, ...card }) => card);
}

export async function getRoute(id) {
  await delay(200);
  const route = ROUTES.find((r) => r.id === id);
  if (!route) throw Object.assign(new Error('Маршрут не найден'), { code: 'NOT_FOUND', status: 404 });
  return route;
}

export async function getBikes() {
  await delay(200);
  const rental = readRental();
  return BIKES.map((b) => (rental && rental.bikeId === b.id ? { ...b, status: 'busy' } : b));
}

export async function getRental() {
  await delay(150);
  return readRental();
}

export async function startRental(bikeId, routeId) {
  await delay(300);
  const existing = readRental();
  if (existing) {
    throw Object.assign(new Error('Аренда уже активна'), { code: 'RENTAL_ACTIVE', status: 409 });
  }
  const bike = BIKES.find((b) => b.id === bikeId);
  const route = ROUTES.find((r) => r.id === routeId);
  if (!bike || bike.status === 'busy') {
    throw Object.assign(new Error('Велосипед уже занят, выберите другой'), { code: 'BIKE_BUSY', status: 409 });
  }
  const rental = {
    id: 'rental-demo',
    bikeId,
    routeId,
    bikeLabel: bike.label,
    routeTitle: route?.title || routeId,
    startedAt: new Date().toISOString(),
  };
  writeRental(rental);
  return rental;
}

export async function finishRental() {
  await delay(200);
  writeRental(null);
  return null;
}
