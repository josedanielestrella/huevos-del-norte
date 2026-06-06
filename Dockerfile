FROM node:20-bookworm-slim AS frontend-build

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend

COPY frontend ./frontend
RUN npm run build --prefix frontend


FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY backend/package*.json ./backend/
RUN npm install --prefix backend

COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 5000

CMD ["npm", "start", "--prefix", "backend"]
