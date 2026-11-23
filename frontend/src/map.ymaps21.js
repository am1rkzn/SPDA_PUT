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
      new Error(
        'Не задан ключ Яндекс.Карт. При разработке добавьте VITE_YANDEX_API_KEY в файл .env, ' +
          'а при сборке образа передайте его аргументом: ' +
          'docker build --build-arg VITE_YANDEX_API_KEY=<ключ> (см. .env.example и Dockerfile).',
      ),
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

// These drawing functions run after createMap has resolved the SDK.
export function drawRoute(map, route) {
  const line = new _ymaps.Polyline(route.geometry.coordinates.map(toLatLng), {}, {
    strokeColor: '#e8482c', strokeWidth: 5, strokeOpacity: 1,
  });
  const start = new _ymaps.Placemark(toLatLng(route.start), { hintContent: 'Старт маршрута' }, {
    preset: 'islands#greenFlagIcon',
  });
  map.geoObjects.add(line);
  map.geoObjects.add(start);
  return () => {
    map.geoObjects.remove(line);
    map.geoObjects.remove(start);
  };
}

export function addBike(map, bike, select) {
  const available = bike.status === 'available';
  const marker = new _ymaps.Placemark(toLatLng(bike.coords), {
    hintContent: bike.label + (available ? ' · свободен' : ' · занят'),
  }, {
    iconLayout: 'default#image',
    iconImageHref: available ? '/markers/bike-available.svg' : '/markers/bike-busy.svg',
    iconImageSize: [36, 36], iconImageOffset: [-18, -36],
    zIndex: 1000,
  });
  const click = () => select(bike.id);
  marker.events.add('click', click);
  map.geoObjects.add(marker);
  return () => {
    marker.events.remove('click', click);
    map.geoObjects.remove(marker);
  };
}

export function fitToPoints(map, points) {
  if (points.length) {
    map.setBounds(_ymaps.util.bounds.fromPoints(points.map(toLatLng)),
      { checkZoomRange: true, zoomMargin: 48 });
  }
}
