FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/types/package*.json ./packages/types/

RUN npm install

COPY . .

RUN npm run build -w @watchverse/types
RUN npm run build -w @watchverse/backend

EXPOSE 3001

CMD ["npm", "run", "start:dev", "-w", "@watchverse/backend"]
