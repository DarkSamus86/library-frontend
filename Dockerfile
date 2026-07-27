FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# Lock-файл проекта содержит совместимый legacy peer-граф для ESLint.
RUN npm ci --legacy-peer-deps

COPY . .

ARG VITE_API_URL=/api-backend
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.29-alpine AS runtime

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_URL=http://backend:8080

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
