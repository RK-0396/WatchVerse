FROM node:20-alpine

WORKDIR /usr/src/app

ARG BACKEND_URL=http://backend:3001
ARG NEXT_PUBLIC_API_URL=http://backend:3001
ARG NEXT_PUBLIC_WS_URL=ws://backend:3001
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

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
