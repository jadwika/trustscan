FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
ENV PORT=8080
ENV NODE_OPTIONS=--no-experimental-fetch
CMD ["node", "server.js"]