     FROM node:20-slim AS web
     WORKDIR /app
     COPY package*.json ./
     RUN npm install
     COPY . .
     RUN npm run build

     FROM node:20-slim
     WORKDIR /app
     COPY server/package*.json ./
     RUN npm install --omit=dev
     COPY server/ ./
     COPY --from=web /app/dist ./public
     ENV PORT=8080
     CMD ["node", "index.js"]
