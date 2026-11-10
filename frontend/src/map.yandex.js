// Вариант карты на Яндекс JS API 3.0 (нужен API-ключ).
// Документация: https://yandex.com/maps-api/docs/js-api/
//
// Как подключить:
// 1) Получи ключ в Кабинете разработчика: https://developer.tech.yandex.ru/
// 2) Вставь ключ в index.html:
//    <script src="https://api-maps.yandex.ru/v3/?apikey=ТВОЙ_КЛЮЧ&lang=ru_RU"></script>
// 3) В src/components/MapView.jsx поменяй импорт '../map.js' на '../map.yandex.js'.

let api = null;

async function loadApi() {
  if (api) return api;
  await ymaps3.ready;
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapFeature, YMapDefaultMarker } = ymaps3;
  api = { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapFeature, YMapDefaultMarker };
  return api;
}

export const DEFAULT_CENTER = [49.11, 55.79]; // [долгота, широта]

export async function createMap(container, options = {}) {
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = await loadApi();
  return new YMap(
    container,
    { location: { center: options.center || DEFAULT_CENTER, zoom: options.zoom ?? 12 } },
    [new YMapDefaultSchemeLayer({}), new YMapDefaultFeaturesLayer({})],
  );
}

export async function drawRoute(map, route) {
  const { YMapFeature } = await loadApi();
  const line = new YMapFeature({
    geometry: { type: 'LineString', coordinates: route.geometry.coordinates },
    style: { stroke: [{ color: '#e8482c', width: 5 }] },
  });
  map.addChild(line);
  return line;
}

export async function addMarker(map, coords, { color } = {}) {
  const { YMapDefaultMarker } = await loadApi();
  const marker = new YMapDefaultMarker({ coordinates: coords, color });
  map.addChild(marker);
  return marker;
}

export async function fitToPoints(map, points) {
  map.update({ location: { center: points[0], zoom: 12 } });
}
