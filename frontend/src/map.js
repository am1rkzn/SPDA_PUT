// Карта по умолчанию: MapLibre GL JS + OpenFreeMap.
// Ключ НЕ нужен. Подложка — бесплатные векторные тайлы на данных OpenStreetMap.
// Документация: https://openfreemap.org/ , https://maplibre.org/maplibre-gl-js/docs/
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Стиль подложки. Доступные варианты: positron, bright, liberty, dark, fiord, 3d.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Центр Казани: [долгота, широта].
export const DEFAULT_CENTER = [49.11, 55.79];

export function createMap(container, options = {}) {
  return new maplibregl.Map({
    container,
    style: MAP_STYLE_URL,
    center: options.center || DEFAULT_CENTER,
    zoom: options.zoom ?? 12,
  });
}

export function drawRoute(map, route) {
  const sourceId = 'route';
  const data = { type: 'Feature', properties: {}, geometry: route.geometry };
  const apply = () => {
    const src = map.getSource(sourceId);
    if (src) {
      src.setData(data);
    } else {
      map.addSource(sourceId, { type: 'geojson', data });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e8482c', 'line-width': 5 },
      });
    }
  };
  if (map.isStyleLoaded()) apply();
  else map.once('load', apply);
}

export function addMarker(map, coords, { color = '#1b8a5a' } = {}) {
  return new maplibregl.Marker({ color }).setLngLat(coords).addTo(map);
}

export function fitToPoints(map, points) {
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  map.fitBounds(
    [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    { padding: 60 },
  );
}
