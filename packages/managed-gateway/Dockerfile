FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm install --include=dev && npm run build && npm prune --omit=dev

EXPOSE 8788
CMD ["node", "dist/server.js"]
