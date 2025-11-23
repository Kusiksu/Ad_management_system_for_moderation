# Dockerfile для бэкенд-сервера
FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

EXPOSE 3001

# Запускаем сервер
CMD ["npm", "start"]


