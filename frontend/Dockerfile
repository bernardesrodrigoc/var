# Estágio de Build
FROM node:18-alpine as build

WORKDIR /app

# Copia arquivos de configuração
COPY package*.json yarn.lock* ./

# Instala dependências (com flag para evitar erros de versão)
RUN if [ -f yarn.lock ]; then yarn install; else npm install --legacy-peer-deps; fi

# Copia o código fonte
COPY . .

# --- AS LINHAS MÁGICAS ---
# Isso permite que o Docker "veja" a variável do Railway
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
# -------------------------

# Faz o build do React
RUN if [ -f yarn.lock ]; then yarn build; else npm run build; fi

# Estágio de Produção (Nginx)
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
