FROM node:12

ENV USER=root
WORKDIR "/"

RUN echo "{}" > networks.json
COPY ./package.json ./yarn.lock ./truffle-config.js ./

RUN yarn

COPY . .

RUN yarn compile