// Демо-данные. Геометрии Казани — ПРИБЛИЗИТЕЛЬНЫЕ заглушки.
// Перед защитой их заменяют на проверенные геометрии от Анны/Сергея.
// Порядок координат везде: [долгота, широта].

export const ROUTES = [
  {
    id: 'r1',
    title: 'Кремлёвская набережная',
    categories: ['активный', 'туристический'],
    durationMin: 30,
    tags: ['набережная', 'центр'],
    rating: 4.7,
    photo: null,
    description: 'Прогулка вдоль Казанки с видом на Кремль.',
    start: [49.105, 55.797],
    geometry: {
      type: 'LineString',
      coordinates: [
        [49.105, 55.797],
        [49.107, 55.799],
        [49.109, 55.801],
        [49.112, 55.801],
        [49.114, 55.799],
      ],
    },
    verified: false,
  },
  {
    id: 'r2',
    title: 'Парк Горького',
    categories: ['спокойный'],
    durationMin: 15,
    tags: ['парк'],
    rating: 4.5,
    photo: null,
    description: 'Лёгкая петля по аллеям парка.',
    start: [49.124, 55.792],
    geometry: {
      type: 'LineString',
      coordinates: [
        [49.124, 55.792],
        [49.127, 55.793],
        [49.128, 55.791],
        [49.125, 55.79],
        [49.124, 55.792],
      ],
    },
    verified: false,
  },
  {
    id: 'r3',
    title: 'Озеро Кабан',
    categories: ['туристический', 'спокойный'],
    durationMin: 45,
    tags: ['набережная', 'озеро'],
    rating: 4.3,
    photo: null,
    description: 'Маршрут вдоль озера Нижний Кабан.',
    start: [49.106, 55.779],
    geometry: {
      type: 'LineString',
      coordinates: [
        [49.106, 55.779],
        [49.108, 55.778],
        [49.11, 55.777],
        [49.113, 55.778],
      ],
    },
    verified: false,
  },
  {
    id: 'r4',
    title: 'Улица Баумана',
    categories: ['туристический'],
    durationMin: 20,
    tags: ['центр'],
    rating: 4.8,
    photo: null,
    description: 'Пешеходная улица с исторической застройкой.',
    start: [49.118, 55.788],
    geometry: {
      type: 'LineString',
      coordinates: [
        [49.118, 55.788],
        [49.119, 55.79],
        [49.121, 55.792],
      ],
    },
    verified: false,
  },
  {
    id: 'r5',
    title: 'Кремлёвский спуск',
    categories: ['туристический', 'активный'],
    durationMin: 25,
    tags: ['центр', 'набережная'],
    rating: 4.6,
    photo: null,
    description: 'Короткий маршрут от Кремля к реке.',
    start: [49.108, 55.795],
    geometry: {
      type: 'LineString',
      coordinates: [
        [49.108, 55.795],
        [49.107, 55.794],
        [49.105, 55.793],
      ],
    },
    verified: false,
  },
  {
    id: 'r6',
    title: 'Набережная Булака',
    categories: ['спокойный'],
    durationMin: 35,
    tags: ['набережная'],
    rating: 4.2,
    photo: null,
    description: 'Спокойная прогулка вдоль канала Булак.',
    start: [49.111, 55.786],
    geometry: {
      type: 'LineString',
      coordinates: [
        [49.111, 55.786],
        [49.112, 55.784],
        [49.114, 55.783],
      ],
    },
    verified: false,
  },
];

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
