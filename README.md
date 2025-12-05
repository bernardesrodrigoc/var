# ExploTrack - Sistema de Gestão de Varejo

Sistema completo de gestão para lojas de varejo com multi-filiais, controle de estoque, vendas, clientes e comissões.

## 🚀 Features

- ✅ **Multi-Filial**: Gestão de múltiplas lojas
- ✅ **Controle de Estoque**: Gerenciamento completo de produtos
- ✅ **PDV (Ponto de Venda)**: Sistema de vendas com pagamentos mistos
- ✅ **Gestão de Clientes**: Cadastro e crédito loja
- ✅ **Recebimento de Pagamentos**: Abater saldo devedor com histórico
- ✅ **Comissões Dinâmicas**: Sistema configurável de comissões e bônus
- ✅ **Fechamento de Caixa**: Controle completo incluindo vendas e recebimentos
- ✅ **Relatórios**: Análises por período com filtros de data
- ✅ **Estorno de Vendas**: Reversão completa de vendas
- ✅ **Importação Excel**: Atualização em massa de produtos

## 🏗️ Stack Tecnológica

- **Backend**: FastAPI (Python 3.11)
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: MongoDB
- **Authentication**: JWT

---

## 📦 Deploy no Railway

### Pré-requisitos
- Conta no [Railway.app](https://railway.app)
- Repositório no GitHub

### Passo 1: Criar Projeto e MongoDB

1. Acesse [Railway.app](https://railway.app) e faça login com GitHub
2. Clique em **+ New Project**
3. Escolha **Provision MongoDB**
4. Clique no banco criado → Aba **Variables** → Copie a `MONGO_URL`

### Passo 2: Deploy do Backend

1. No projeto Railway, clique em **+ New** → **GitHub Repo**
2. Selecione seu repositório
3. Clique no serviço criado → **Settings**
4. Configure:
   - **Root Directory**: `/backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

5. Vá em **Variables** e adicione:
   ```
   MONGO_URL=<cole a URL do MongoDB>
   DB_NAME=explotrack
   SECRET_KEY=<gere uma senha forte>
   CORS_ORIGINS=*
   PORT=8001
   ```

6. Vá em **Settings** → **Networking** → **Generate Domain**
7. **Copie a URL gerada** (ex: `https://backend-production.up.railway.app`)

### Passo 3: Deploy do Frontend

1. No projeto Railway, clique em **+ New** → **GitHub Repo**
2. Selecione o **mesmo repositório** novamente
3. Clique no novo serviço → **Settings**
4. Configure:
   - **Root Directory**: `/frontend`

5. Vá em **Variables** e adicione:
   ```
   REACT_APP_BACKEND_URL=<URL do backend sem barra no final>
   ```
   Exemplo: `https://backend-production.up.railway.app`

6. Vá em **Settings** → **Networking** → **Generate Domain**
7. Acesse a URL gerada do frontend!

### Resultado Final

Você terá 3 serviços:
- 🗄️ **MongoDB** (banco de dados)
- 🔧 **Backend** (API FastAPI)
- 🎨 **Frontend** (React)

---

## 🐳 Executar com Docker Localmente

### 1. Clone o repositório
```bash
git clone <seu-repositorio>
cd <seu-repositorio>
```

### 2. Configure as variáveis de ambiente

**Backend** (`/backend/.env`):
```bash
cp backend/.env.example backend/.env
```

**Frontend** (`/frontend/.env`):
```bash
cp frontend/.env.example frontend/.env
```

### 3. Inicie os containers
```bash
docker-compose up -d
```

### 4. Acesse a aplicação
- Frontend: http://localhost
- Backend: http://localhost:8001
- MongoDB: localhost:27017

### 5. Login padrão
```
Usuário: admin
Senha: admin123
```

---

## 💻 Desenvolvimento Local (sem Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env
yarn start
```

---

## 🔐 Credenciais Padrão (Seed Data)

O sistema cria automaticamente:
- **Usuário**: `admin`
- **Senha**: `admin123`
- **Filial**: `Loja Principal`

⚠️ **IMPORTANTE**: Altere a senha padrão em produção!

---

## 📚 Estrutura do Projeto

```
/
├── backend/
│   ├── server.py          # API FastAPI
│   ├── seed_data.py       # Dados iniciais
│   ├── requirements.txt   # Dependências Python
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── context/       # Context API (FilialContext)
│   │   └── lib/           # Utilitários (api.js)
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Principais Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Criar usuário (admin only)

### Produtos
- `GET /api/products` - Listar produtos
- `POST /api/products` - Criar produto
- `PUT /api/products/{id}` - Atualizar produto

### Vendas
- `GET /api/sales` - Listar vendas
- `POST /api/sales` - Criar venda
- `DELETE /api/sales/{id}/estornar` - Estornar venda

### Clientes
- `GET /api/customers` - Listar clientes
- `POST /api/customers/{id}/pagar-saldo` - Registrar pagamento
- `GET /api/customers/{id}/historico-pagamentos` - Histórico

### Relatórios
- `GET /api/reports/dashboard` - Dashboard geral
- `GET /api/reports/sales-by-vendor` - Vendas por vendedor
- `GET /api/reports/pagamentos-detalhados` - Relatório de pagamentos

### Fechamento de Caixa
- `GET /api/fechamento-caixa/hoje` - Resumo do dia
- `POST /api/fechamento-caixa` - Salvar fechamento

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT.

---

## 🐛 Problemas?

Se encontrar algum problema, abra uma [issue](https://github.com/seu-usuario/seu-repo/issues).

---

## 👨‍💻 Desenvolvido por

Sistema desenvolvido para gestão completa de lojas de varejo.
