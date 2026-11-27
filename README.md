# ПУТЬ

**ПУТЬ** — веб-приложение для подбора персонализированных велопрогулок по Казани. Пользователь задаёт характер поездки, продолжительность и интересы, получает подходящие маршруты и может посмотреть выбранный маршрут на карте. Также пользователь может выбрать один из свободных велосипедов, отмеченных на карте. В текущем наборе представлены демонстрационные данные о велосипедах и маршрутах.

## Команда


| Участник | Роль в проекте |
|---|---|
| **Валеев Амир** | backend-разработка и devops-инженерия | 
| **Храмцов Егор** | fullstack-разработчик |
| **Перекрестова Ирина** | backend-разработка | 
| **Пешков Сергей** | аналитика |
| **Мингалёва Анна** | аналитика | 

## Технологии

- **Frontend:** React 18, Vite 5, JavaScript; карты — Яндекс JS API 2.1 (активный адаптер) или MapLibre GL JS с OpenFreeMap.
- **Backend:** Python 3.12, FastAPI, Uvicorn, Pydantic.
- **Хранение:** SQLite; схема и начальные данные находятся в `backend/schema.sql` и `backend/seed.json`.
- **Наблюдаемость:** OpenTelemetry SDK и экспортёр OTLP/HTTP для логов, метрик и трейсов.
- **Сборка и запуск:** Docker, Node.js 22 для сборки Frontend.
- **Тесты Backend:** `unittest` и HTTPX.

## Установка и запуск

### Требования

- Python 3.12
- Node.js 22 и npm
- Docker (только для запуска контейнера)

Команды ниже приведены для PowerShell. Для остальных оболочек замените команды активации окружения и копирования `.env` на соответствующие им.

### Локальная разработка с Backend

1. Установите зависимости Python и запустите API из корня репозитория:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python -m pip install -r backend/requirements-test.txt
   .\.venv\Scripts\python -m uvicorn backend.main:app --port 8000 --no-access-log
   ```

   По умолчанию SQLite-файл `put.sqlite` создаётся в текущем каталоге. Чтобы задать другое расположение, установите `PUT_DB_PATH` перед запуском, например `$env:PUT_DB_PATH = 'C:\data\put.sqlite'`.

2. В отдельном окне PowerShell включите реальный API для Frontend и запустите Vite:

   ```powershell
   $env:VITE_USE_MOCK = "false"
   $env:VITE_API_BASE_URL = "/api"
   npm.cmd --prefix frontend ci
   npm.cmd --prefix frontend run dev
   ```

3. Откройте адрес Vite, обычно `http://localhost:5173`. Запросы `/api` проксируются на Backend `http://localhost:8000`.

Для карты с активным адаптером Яндекс JS API 2.1 задайте ключ в окружении **до запуска Vite**: `$env:VITE_YANDEX_API_KEY = 'ваш-ключ'`. Ключ используется в браузере, поэтому ограничьте его допустимыми HTTP Referer в кабинете Яндекса. Без ключа API и остальной интерфейс остаются доступны, но карта может не загрузиться.

### Только Frontend с демо-данными

Backend для этого режима не требуется:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev
```

Режим по умолчанию использует mock-данные. Для локальной конфигурации можно скопировать `frontend/.env.example` в `frontend/.env` и изменить `VITE_USE_MOCK` и параметры карты. Не добавляйте личный ключ в репозиторий.

### Запуск в Docker

Из корня репозитория соберите и запустите единый образ:

```powershell
docker build -t put-backend:local .
docker run --rm --name put-local -p 127.0.0.1:8000:8000 -v put-data:/data put-backend:local
```

Откройте приложение на `http://127.0.0.1:8000/`, интерактивную документацию API — на `http://127.0.0.1:8000/docs`. SQLite хранится в Docker volume `put-data` и сохраняется между запусками контейнера. Для сборки с ключом карты задайте `$env:VITE_YANDEX_API_KEY = 'ваш-ключ'` и выполните:

```powershell
docker build --build-arg VITE_YANDEX_API_KEY -t put-backend:local .
```

Ключ встраивается в клиентскую сборку и не является секретом; защитите его ограничением Referer.

## Проверки

При установленном окружении Python выполните тесты Backend из корня:

```powershell
.\.venv\Scripts\python -m unittest discover -s backend -p "test_*.py" -v
```

Проверить production-сборку Frontend можно командой:

```powershell
npm.cmd --prefix frontend run build
```

Проверки состояния Backend доступны на `/healthz` и `/readyz`. Дополнительные инструкции по OTLP, локальному стенду и примерам манифестов находятся в [`backend/README.md`](backend/README.md).
