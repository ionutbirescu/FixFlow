# Builds the React app, then serves the static files with Nginx on port 80.
# Compose maps it to http://localhost:3000.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The browser calls S1 and S2 directly, so their public URLs are baked into the bundle at build time.
# The client reads them as import.meta.env.VITE_S1_URL and import.meta.env.VITE_S2_URL.
ARG VITE_S1_URL=http://localhost:8081
ARG VITE_S2_URL=http://localhost:8082
ENV VITE_S1_URL=$VITE_S1_URL \
    VITE_S2_URL=$VITE_S2_URL
RUN npm run build

FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
