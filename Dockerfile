FROM node:10

WORKDIR /server

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 2222

CMD ["npm", "run", "dev"]
