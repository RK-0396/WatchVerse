FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/types/package*.json ./packages/types/

RUN npm install

COPY . .

# Build both type packages and the Next.js frontend application
RUN npm run build -w @watchverse/types
RUN npm run build -w @watchverse/frontend

EXPOSE 3000

# Start in production mode for absolute stability
CMD ["npm", "run", "start", "-w", "@watchverse/frontend"]
