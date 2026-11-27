FROM node:22-alpine AS web
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY data/routes_kazan.json /data/routes_kazan.json
COPY frontend/ ./
ARG VITE_YANDEX_API_KEY=""
ENV VITE_USE_MOCK=false VITE_API_BASE_URL=/api
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PUT_DB_PATH=/data/put.sqlite
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && mkdir /data && chown 10001:10001 /data
COPY backend/ /app/backend/
COPY data/routes_kazan.json /app/data/routes_kazan.json
COPY --from=web /frontend/dist /app/frontend/dist
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000","--workers","1","--no-access-log"]
