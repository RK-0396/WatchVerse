FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/types/package*.json ./packages/types/

RUN npm install

COPY . .

RUN npm run build -w @watchverse/types

EXPOSE 3000

CMD ["npm", "run", "dev", "-w", "@watchverse/frontend"]
