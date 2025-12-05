# 🚂 Guia de Deploy no Railway - ExploTrack

## 📋 Checklist Antes de Começar

- [ ] Código no GitHub
- [ ] Conta no Railway.app
- [ ] Arquivo `.env.example` configurado (já está!)

---

## 🎯 Passo a Passo Completo

### 1️⃣ Preparar o Repositório GitHub

```bash
# 1. Adicione todos os arquivos
git add .

# 2. Commit
git commit -m "Deploy: Configuração completa para Railway"

# 3. Push para o GitHub
git push origin main
```

---

### 2️⃣ Criar Projeto no Railway

1. Acesse: https://railway.app
2. Faça login com GitHub
3. Clique em **"+ New Project"**

---

### 3️⃣ Provisionar MongoDB

1. Clique em **"Provision MongoDB"**
2. Aguarde o banco ser criado (ícone roxo)
3. Clique no **MongoDB** criado
4. Vá na aba **"Variables"** ou **"Connect"**
5. **Copie o valor de `MONGO_URL`** (algo como: `mongodb://mongo:...@monorail.proxy.rlwy.net:12345`)
6. ✅ Guarde essa URL em um bloco de notas!

---

### 4️⃣ Deploy do Backend (API)

#### 4.1. Adicionar o Repositório

1. No projeto Railway, clique em **"+ New"**
2. Selecione **"GitHub Repo"**
3. Autorize o Railway a acessar seus repositórios (se necessário)
4. Selecione o repositório **ExploTrack**

#### 4.2. Configurar o Backend

1. Clique no **serviço criado** (vai estar falhando - normal!)
2. Vá em **"Settings"** (engrenagem)
3. Configure:

   **Root Directory:**
   ```
   backend
   ```

   **Build Command:** (deixe vazio, Railway detecta automaticamente)
   
   **Start Command:**
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```

#### 4.3. Adicionar Variáveis de Ambiente

1. Vá na aba **"Variables"**
2. Clique em **"+ New Variable"** e adicione:

   | Variável | Valor | Exemplo |
   |----------|-------|----------|
   | `MONGO_URL` | Cole a URL do MongoDB (passo 3) | `mongodb://mongo:...` |
   | `DB_NAME` | `explotrack` | `explotrack` |
   | `SECRET_KEY` | Invente uma senha forte | `minha-senha-super-secreta-123` |
   | `CORS_ORIGINS` | `*` | `*` |
   | `PORT` | `8001` | `8001` |

3. Clique em **"Deploy"** (ou aguarde o redeploy automático)

#### 4.4. Gerar URL Pública do Backend

1. Ainda nas **Settings** do backend
2. Vá em **"Networking"**
3. Clique em **"Generate Domain"**
4. ✅ **Copie a URL gerada** (ex: `backend-production-abc123.up.railway.app`)
5. ⚠️ **Importante**: Cole essa URL em um bloco de notas!

---

### 5️⃣ Deploy do Frontend (React)

#### 5.1. Adicionar o Repositório Novamente

1. No projeto Railway, clique em **"+ New"** novamente
2. Selecione **"GitHub Repo"**
3. Selecione o **mesmo repositório** (ExploTrack)

#### 5.2. Configurar o Frontend

1. Clique no **novo serviço criado**
2. Vá em **"Settings"**
3. Configure:

   **Root Directory:**
   ```
   frontend
   ```

   **Build Command:** (deixe vazio ou use)
   ```
   yarn build
   ```

   **Start Command:** (deixe vazio, Nginx cuida disso)

#### 5.3. Adicionar Variável de Ambiente do Frontend

1. Vá na aba **"Variables"**
2. Clique em **"+ New Variable"** e adicione:

   | Variável | Valor |
   |----------|-------|
   | `REACT_APP_BACKEND_URL` | URL do backend (passo 4.4) **SEM barra no final** |

   **Exemplo:**
   ```
   https://backend-production-abc123.up.railway.app
   ```
   ⚠️ **Atenção**: NÃO coloque `/` no final!

3. Aguarde o deploy automático

#### 5.4. Gerar URL Pública do Frontend

1. Nas **Settings** do frontend
2. Vá em **"Networking"**
3. Clique em **"Generate Domain"**
4. ✅ **Acesse a URL gerada!**

---

## ✅ Verificação Final

Seu painel do Railway deve ter **3 serviços**:

```
📦 Seu Projeto
├── 🗄️ MongoDB (roxo)
├── 🔧 Backend (verde)
└── 🎨 Frontend (verde)
```

---

## 🎉 Primeiro Acesso

1. Acesse a URL do Frontend
2. Use as credenciais padrão:
   ```
   Usuário: admin
   Senha: admin123
   ```
3. Selecione a filial "Loja Principal"
4. ✅ **Sistema funcionando!**

---

## 🐛 Troubleshooting

### Backend não inicia?

1. Verifique os logs: Clique no backend → aba **"Deployments"** → último deploy → **"View Logs"**
2. Problemas comuns:
   - `MONGO_URL` incorreta ou vazia
   - `PORT` não configurado
   - Dependências faltando (verifique `requirements.txt`)

### Frontend não carrega?

1. Verifique os logs do frontend
2. Problemas comuns:
   - `REACT_APP_BACKEND_URL` com `/` no final (REMOVA!)
   - Backend não está acessível
   - Erro de CORS (verifique `CORS_ORIGINS=*` no backend)

### Erro 502 Bad Gateway?

- Aguarde alguns minutos, o Railway pode estar reiniciando
- Verifique se o backend está **verde** (rodando)

### Banco de dados não conecta?

- Certifique-se que o `MONGO_URL` está correto
- O Railway gera a URL automaticamente quando você provisiona o MongoDB

---

## 🔒 Segurança em Produção

⚠️ **Depois de fazer o primeiro deploy:**

1. Faça login como `admin`
2. Crie um novo usuário admin com senha forte
3. Mude o `SECRET_KEY` para algo realmente seguro
4. Configure `CORS_ORIGINS` para a URL específica do frontend:
   ```
   CORS_ORIGINS=https://seu-frontend.up.railway.app
   ```

---

## 💰 Custos

- Railway oferece **$5 USD/mês grátis** para trial
- Depois disso, você paga apenas pelo uso
- Geralmente custa **$5-10/mês** para apps pequenos

---

## 📞 Precisa de Ajuda?

- Documentação Railway: https://docs.railway.app
- Discord Railway: https://discord.gg/railway

---

**Boa sorte com seu deploy! 🚀**
