FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN test -f prisma/schema.prisma && npx prisma generate || true

CMD ["npm", "run", "dev"]
