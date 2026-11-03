# ПУТЬ — фронтенд (React + Vite)

Рабочий интерфейс для проекта «ПУТЬ»: персонализированные велопрогулки по Казани
с опциональной арендой велосипеда.

Поток: **предпочтения → рекомендации → маршрут на карте → (по желанию) аренда → завершение**.
Просмотр маршрута работает **без аренды**; аренда передаёт уже выбранный маршрут на Backend.

## 1. Быстрый старт

```bash
cd frontend
npm install
cp .env.example .env   # и впиши свой ключ Яндекса, если нужен (см. раздел 3)
npm run dev
```

Открой http://localhost:5173 — приложение работает сразу на **демо-данных** (Backend не нужен).

Сборка для продакшена:

```bash
npm run build     # соберёт в папку dist/
npm run preview   # локальный просмотр собранной версии
```

## 2. Карта и ключ API — важный момент

Карта — **клиентская**, поэтому ключ Яндекс.Карт в любом случае оказывается в браузере
(в собранном JS/HTML он виден в DevTools). Полностью «спрятать» его нельзя — это свойство
клиентских карт.

Что даёт рефакторинг с `.env`:

- ключ **не попадает в git-репозиторий** (файл `.env` в `.gitignore`);
- в репозитории лежит только пустой шаблон `.env.example`;
- каждый разработчик подставляет свой ключ локально / через секреты CI.

**Реальная защита ключа — «Ограничение по HTTP Referer»** в Кабинете разработчика Яндекса:
ключ работает только на указанных доменах. Это нужно настроить обязательно, особенно для
GitHub Pages.

## 3. Как получить ключ Яндекс.Карт

1. Открой [Кабинет разработчика](https://developer.tech.yandex.ru/) и войди через Яндекс ID.
2. Создай ключ, выбери пакет **«JavaScript API»** (карты). Ключ активируется ~15 минут.
3. Обязательно заполни **«Ограничение по HTTP Referer»**:
   - `localhost` и `127.0.0.1` — для локальной разработки;
   - `username.github.io` — для GitHub Pages (поддомены добавляются автоматически);
   - домен облачного стенда, если он есть.
4. Вставь ключ в `.env`:

   ```
   VITE_YANDEX_API_KEY=твой-ключ
   ```

   Скрипт Яндекса подключается динамически в [`src/map.ymaps21.js`](src/map.ymaps21.js)
   и берёт ключ из этой переменной. В `index.html` ничего вставлять не нужно.

> Если ключа нет — карта покажет понятную ошибку «Не задан ключ Яндекс.Карт…», а остальной
> интерфейс продолжит работать.

## 4. Варианты карты

- **По умолчанию** — Яндекс JS API 2.1 ([`src/map.ymaps21.js`](src/map.ymaps21.js)), ключ из `.env`.
- **Без ключа** — MapLibre + OpenFreeMap ([`src/map.js`](src/map.js)). Чтобы переключиться,
  поменяй импорт в [`src/components/MapView.jsx`](src/components/MapView.jsx):

  ```js
  // Яндекс (по умолчанию):
  import { createMap, drawRoute, addMarker, fitToPoints } from '../map.ymaps21.js';
  // Без ключа:
  import { createMap, drawRoute, addMarker, fitToPoints } from '../map.js';
  ```

## 5. Как подключить реальный Backend (FastAPI)

Сейчас приложение работает на демо-данных ([`src/mockData.js`](src/mockData.js)). Когда Backend будет готов:

1. В `.env` поставь `VITE_USE_MOCK=false`.
2. Адрес API — `VITE_API_BASE_URL=/api` (при разработке Vite проксирует `/api` на
   `http://localhost:8000`, см. [`vite.config.js`](vite.config.js)).

Контракт обмена (endpoint'ы и JSON) описан в [`FRONTEND_EGOR_N1.md`](../FRONTEND_EGOR_N1.md).

## 6. Структура

```
frontend/
├── index.html            # точка входа (ключ Яндекса тут НЕ хранится)
├── vite.config.js        # прокси /api → Backend
├── .env.example          # шаблон настроек (ключ сюда не пишем)
└── src/
    ├── main.jsx          # точка входа React
    ├── App.jsx           # состояние, шаги потока B, cross-fade
    ├── App.css           # стили (шрифты MTS Compact, сетка рекомендаций)
    ├── api.js            # клиент API (демо или реальный Backend)
    ├── mockData.js       # демо-данные (маршруты/велосипеды/аренда)
    ├── map.ymaps21.js    # карта: Яндекс JS API 2.1 (ключ из .env)
    ├── map.js            # карта: MapLibre + OpenFreeMap (без ключа)
    └── components/       # PreferenceForm, Recommendations, RouteTile, MapView,
                          # BikePicker, ActiveRental, StatusBanner
```

## 7. Деплой на GitHub Pages

1. **Настрой Referer** для ключа Яндекса: добавь `username.github.io` (см. раздел 3).
2. Собери проект:

   ```bash
   npm run build
   ```

3. Опубликуй содержимое `dist/` на GitHub Pages (вручную или через GitHub Actions).

**Вариант через GitHub Actions:** добавь ключ в *Settings → Secrets and variables → Actions*
как `VITE_YANDEX_API_KEY`, а в workflow передай его на шаг сборки:

```yaml
- run: npm ci && npm run build
  env:
    VITE_YANDEX_API_KEY: ${{ secrets.VITE_YANDEX_API_KEY }}
```

> Помни: в собранном сайте ключ всё равно будет виден в DevTools — это нормально для
> клиентского API карт. Защиту обеспечивает именно Referer-ограничение, а не сокрытие ключа.

## 8. Что заменить перед защитой

- **Геометрии маршрутов** в [`src/mockData.js`](src/mockData.js) — приблизительные заглушки.
  Замени их на проверенные геометрии Казани от Анны/Сергея (порядок: `[долгота, широта]`).
- **Демо-данные** — отключи через `VITE_USE_MOCK=false` после подключения Backend.
