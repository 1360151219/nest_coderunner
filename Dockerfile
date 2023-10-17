FROM node

WORKDIR /home/user

RUN npm config set registry https://registry.npmmirror.com \
  && npm init -y \
  && npm install typescript