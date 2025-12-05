# Estágio de Build
FROM node:18-alpine as build

WORKDIR /app

# Copia package.json e lock files (se existirem)
COPY package*.json yarn.lock* ./

# Instala dependências (tenta yarn, se falhar usa npm)
# Adicionamos --legacy-peer-deps para ignorar o conflito do date-fns
RUN if [ -f yarn.lock ]; then yarn install; else npm install --legacy-peer-deps; fi

# Copia o restante do código
COPY . .

# --- CORREÇÃO IMPORTANTE AQUI ---
# Recebe a variável do Railway durante o build
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
# -------------------------------

# Build da aplicação
RUN if [ -f yarn.lock ]; then yarn build; else npm run build; fi

# Estágio de Produção (Nginx)
FROM nginx:alpine

# Copia os arquivos buildados
COPY --from=build /app/build /usr/share/nginx/html

# Copia configuração do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
