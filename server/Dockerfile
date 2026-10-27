FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/server.js ./
COPY js ./js
EXPOSE 8080
CMD ["node", "server.js"]
