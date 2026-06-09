FROM node:20-bullseye-slim AS development
WORKDIR /usr/src/app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY knexfile.ts ./
COPY src ./src

EXPOSE 5001

CMD ["npm", "run", "dev"]
