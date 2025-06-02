# Dockerfile
FROM node:18

WORKDIR /app

COPY backend backend
COPY frontend frontend
COPY package*.json ./

RUN npm install

EXPOSE 3000

CMD ["node", "backend/server.js"]

