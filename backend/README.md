# Локальный стенд «ПУТЬ»

Выполняйте команды PowerShell из корня репозитория. Все вкладки и браузеры на одном стенде работают с пользователем `demo`. Начальный каталог содержит пять велосипедов `b1`–`b5` (у `b2` и `b4` уже есть активная аренда у отдельных демопользователей, поэтому в интерфейсе видны оба статуса) и пять маршрутов из [каталога Казани](../data/routes_kazan.json). За «Лесом в центре Казани» закреплён ID `r1`. Признак `verified: false` сохраняется до проверки линии на месте.

## Запуск в Docker

```powershell
docker build -t put-backend:local .
docker run --rm --name put-local -p 127.0.0.1:8000:8000 -v put-data:/data put-backend:local
```

Откройте [приложение](http://127.0.0.1:8000/) или [Swagger UI](http://127.0.0.1:8000/docs). FastAPI обслуживает сборку Vite и `/api` с одного адреса. Файл SQLite находится в томе `put-data`. Для проверки сохранности начните аренду, остановите контейнер командой `docker stop put-local`, повторите команду запуска с тем же томом и обновите страницу.

Для отображения карты задайте публичный ключ JS API Яндекс.Карт в переменной PowerShell `$env:VITE_YANDEX_API_KEY` и соберите образ командой `docker build --build-arg VITE_YANDEX_API_KEY -t put-backend:local .`. Разрешите адрес интерфейса в настройках ключа. Ключ встраивается при сборке Vite. При пустом ключе доступны подбор, карточка, старт и завершение аренды.

## Разработка и тесты

Для запуска из исходников используйте Python 3.12 и Node.js 22. В первом окне запустите API:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-test.txt
.\.venv\Scripts\python -m uvicorn backend.main:app --port 8000 --no-access-log
```

По умолчанию БД появится в текущем каталоге как `put.sqlite`. Путь можно изменить переменной `PUT_DB_PATH` до запуска. Во втором окне запустите Vite:

```powershell
$env:VITE_USE_MOCK = "false"
$env:VITE_API_BASE_URL = "/api"
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev
```

Откройте адрес из вывода Vite. Прокси направляет `/api` на порт 8000. Автотесты используют временные БД и локальный приёмник OTLP. Команда для повторной проверки:

```powershell
.\.venv\Scripts\python -m unittest discover -s backend -p "test_*.py" -v
```

## Настройки для будущего выпуска

Скопируйте файлы `deploy/*.example.yaml` в `deploy/local/`. Заполненные копии исключены из Git. Примеры рассчитаны на namespace `team-2`.

| Файл | Какие значения заполнить |
|---|---|
| `app.example.yaml` | Обязательны `containers[0].image` с полным адресом образа и тегом или digest и `PUT_VERSION` с версией сборки. Для закрытого registry укажите существующий `imagePullSecrets`. Если нет подходящего класса по умолчанию, укажите `storageClassName`. |
| `otel-secret.example.yaml` | Впишите базовый HTTPS endpoint и значение заголовков из настроек OpenTelemetry Grafana Cloud для Python. Токену нужны права отправки логов, метрик и трейсов. SDK добавляет пути сигналов к базовому endpoint. Имя Secret `put-otel` уже совпадает со ссылкой в Deployment. |
| `ingress.example.yaml` | Впишите класс Ingress, домен в обоих полях и имя TLS Secret для него. Если доступ на курсе организован через port-forward, Ingress можно пропустить. |
| `grafana-dashboard.json` | При импорте выберите источник Mimir с интерфейсом Prometheus в переменной панели. Графики показывают HTTP-запросы, долю 5xx, p95 в миллисекундах и продуктовые события. |

Deployment запускает один Pod и один Uvicorn worker со стратегией `Recreate`. Перед выпуском проверьте, что класс тома поддерживает блокировки SQLite, процесс с UID 10001 может писать в `/data`, а Pod может отправлять HTTPS на адрес Grafana Cloud. Проверка готовности доступна на `/readyz`, проверка процесса на `/healthz`.

## Телеметрия

По умолчанию локально `PUT_OTEL_ENABLED=false`. При включённом экспорте SDK отправляет три сигнала по OTLP/HTTP в фоне. Соединение с облаком для локальных тестов не требуется.

- **Loki.** В Grafana Explore выберите сервис `put-backend`. Возьмите `X-Request-ID` из ответа API и найдите соответствующий HTTP-лог по атрибуту `request_id`. События `rental_started` и `rental_finished` означают зафиксированные изменения в БД.
- **Tempo.** Скопируйте trace ID из записи лога и откройте его в Tempo. Трейс содержит запрос и вложенную операцию подбора или аренды.
- **Mimir.** Метрики SDK `put.http.requests`, `put.http.duration` и `put.events` соответствуют HTTP-запросам, задержке и продуктовым событиям. При повторе команды растёт HTTP-счётчик. Счётчик аренды меняется один раз при записи изменения.
