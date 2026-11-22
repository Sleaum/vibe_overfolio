# Étape 1 : build de l'app Vue
FROM node:24-alpine AS build

WORKDIR /app

# Copie des dépendances : npm ci installe exactement les versions de package-lock.json (celles vérifiées par npm audit)
COPY package*.json ./
RUN npm ci

# Copie du reste des fichiers et build
COPY . .
RUN npm run build

