#> /bin/bash
#> docker build --platform linux/amd64 --no-cache -t checha/media-server .
#> docker push checha/media-server
FROM ubuntu:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y curl \
  net-tools \
  build-essential \
  python3.9 \
  python3-distutils \
  python3-apt \
  valgrind \
  g++ \
  gcc

RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
RUN python3.9 get-pip.py

RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y \
 nodejs

COPY . .

RUN npm install -g @nestjs/cli pm2

RUN PYTHON=python3.9 npm install mediasoup@3

RUN npm install && npm run build

EXPOSE 10000-10100

EXPOSE 2000-2020

EXPOSE 3000

CMD ["node", "dist/main", "--hostname", "0.0.0.0"]
