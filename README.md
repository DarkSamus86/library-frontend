# Chapter — frontend библиотеки

React SPA для backend Library: авторизация по JWT, каталог книг, профиль
читателя и административная панель.

## Запуск

Требуется запущенный backend на `http://localhost:8080`.

```bash
npm run dev
```

Vite откроет frontend на `http://localhost:5173` и проксирует запросы
`/api-backend` в backend. Другой адрес API можно указать в `.env.local`:

```env
VITE_API_URL=/api-backend
```

## Проверка

```bash
npm run lint
npm run build
```

Production-сборка создаётся в `dist/`. В production frontend и backend
нужно разместить под одним origin и направить `/api-backend` на backend.

## Docker

Собрать production-образ:

```bash
docker build -t library-frontend .
```

Контейнер ожидает, что backend доступен по адресу `http://backend:8080`.
При другом адресе передайте `BACKEND_URL`:

```bash
docker run --rm \
  -p 80:80 \
  -e BACKEND_URL=http://library-backend:8080 \
  --name library-frontend \
  library-frontend
```

Frontend будет доступен на `http://localhost`. Для связи контейнеров по
имени подключите их к одной Docker network. Endpoint `/health` можно
использовать для health check оркестратора.

Если frontend должен обращаться к API по другому browser URL, задайте его
при сборке:

```bash
docker build \
  --build-arg VITE_API_URL=/api-backend \
  -t library-frontend .
```

## Реализовано

- регистрация, вход, восстановление сессии, refresh и logout;
- guards для авторизованного пользователя и роли `ROLE_ADMIN`;
- каталог с поиском, сортировкой, пагинацией и URL-параметрами;
- детальная страница книги с fallback обложки;
- просмотр и редактирование профиля, смена пароля;
- dashboard, управление пользователями и ролями;
- создание, редактирование, soft/hard delete книг;
- асинхронный импорт из Open Library;
- loading, error и empty states, адаптивная вёрстка от 360 px.

Валюта отображения временно установлена в KZT, поскольку backend не
возвращает код валюты.
