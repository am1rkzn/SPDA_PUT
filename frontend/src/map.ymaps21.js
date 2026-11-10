// Вариант карты на Яндекс JS API 2.1 (стабильное API).
// Ключ берётся из переменной окружения VITE_YANDEX_API_KEY (файл .env — не коммитится).
// Скрипт Яндекса подключается динамически, поэтому в index.html его вставлять не нужно.
//
// ВАЖНО: в 2.1 координаты передаются как [широта, долгота] (наоборот относительно 3.0
// и наших данных [долгота, широта]), поэтому здесь они преобразуются функцией toLatLng.

export const DEFAULT_CENTER = [55.79, 49.11]; // [широта, долгота] — Казань

function toLatLng([lon, lat]) {
  return [lat, lon];
}

let _ymaps = null;
let _scriptPromise = null;

function loadScript() {
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (_scriptPromise) return _scriptPromise;

  const key = import.meta.env.VITE_YANDEX_API_KEY;
  if (!key) {
    return Promise.reject(
      new Error('Не задан ключ Яндекс.Карт. Добавьте VITE_YANDEX_API_KEY в файл .env (см. .env.example).'),
    );
  }

  _scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => resolve(window.ymaps);
    script.onerror = () => {
      _scriptPromise = null;
      reject(new Error('Не удалось загрузить Яндекс.Карты. Проверьте ключ и доступ к сети.'));
    };
    document.head.appendChild(script);
  });
  return _scriptPromise;
}

async function loadApi() {
  if (_ymaps) return _ymaps;
  await loadScript();
  if (!window.ymaps) {
    throw new Error('Яндекс.Карты не загрузились.');
  }
  await new Promise((resolve) => window.ymaps.ready(resolve));
  _ymaps = window.ymaps;
  return _ymaps;
}

export async function createMap(container, options = {}) {
  const ymaps = await loadApi();
  const center = options.center ? toLatLng(options.center) : DEFAULT_CENTER;
  return new ymaps.Map(container, {
    center,
    zoom: options.zoom ?? 12,
    controls: ['zoomControl'],
  });
}

export async function drawRoute(map, route) {
  const ymaps = await loadApi();
  const coords = route.geometry.coordinates.map(toLatLng);
  const line = new ymaps.Polyline(coords, {}, {
    strokeColor: '#e8482c',
    strokeWidth: 5,
    strokeOpacity: 1,
  });
  map.geoObjects.add(line);
  return line;
}

export async function addMarker(map, coords, { color = '#1b8a5a' } = {}) {
  const ymaps = await loadApi();
  const marker = new ymaps.Placemark(toLatLng(coords), {}, {
    preset: 'islands#circleIcon',
    iconColor: color,
  });
  map.geoObjects.add(marker);
  return { remove: () => map.geoObjects.remove(marker) };
}

export async function fitToPoints(map, points) {
  const ymaps = await loadApi();
  map.setBounds(ymaps.util.bounds.fromPoints(points.map(toLatLng)), { checkZoomRange: true });
}
