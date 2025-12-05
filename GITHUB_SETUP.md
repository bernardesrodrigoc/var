# 📦 Como Preparar para o GitHub

## 📁 Estrutura do Repositório

Seu repositório deve ter esta estrutura:

```
seu-repositorio/
├── backend/
│   ├── server.py
│   ├── seed_data.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── .gitignore
├── .dockerignore
├── docker-compose.yml
├── README.md
├── RAILWAY_DEPLOY.md
└── setup.sh
```

---

## 🚀 Passo a Passo para Subir no GitHub

### 1. Criar Repositório no GitHub

1. Acesse https://github.com
2. Clique em **"New repository"** (botão verde)
3. Nome do repositório: `explotrack` (ou o nome que preferir)
4. Deixe como **Public** ou **Private**
5. **NÃO** marque "Add README" (já temos um)
6. Clique em **"Create repository"**

---

### 2. Preparar os Arquivos Localmente

Na máquina onde você baixou o código do Emergent:

```bash
# 1. Navegue até a pasta do projeto
cd /app

# 2. Inicialize o git (se ainda não estiver)
git init

# 3. Adicione todos os arquivos
git add .

# 4. Faça o primeiro commit
git commit -m "Initial commit: ExploTrack completo para deploy"

# 5. Conecte ao seu repositório GitHub
# (Substitua SEU-USUARIO e SEU-REPO pelos seus valores)
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git

# 6. Envie para o GitHub
git branch -M main
git push -u origin main
```

---

### 3. Verificar no GitHub

Acesse seu repositório no GitHub e verifique se os seguintes arquivos estão lá:

- ✅ `/backend/Dockerfile`
- ✅ `/backend/.env.example`
- ✅ `/frontend/Dockerfile`
- ✅ `/frontend/.env.example`
- ✅ `/README.md`
- ✅ `/RAILWAY_DEPLOY.md`
- ✅ `.gitignore`

**IMPORTANTE:** 
- ❌ **NÃO deve ter** arquivos `.env` (só `.env.example`)
- ❌ **NÃO deve ter** pastas `node_modules/` ou `__pycache__/`

---

## 🔒 Arquivos que NÃO devem estar no GitHub

O `.gitignore` já está configurado para ignorar:

- `.env` (variáveis secretas)
- `node_modules/` (dependências do Node)
- `__pycache__/` (cache do Python)
- `.venv/`, `venv/` (ambiente virtual Python)
- Arquivos de IDE (`.vscode/`, `.idea/`)

---

## 📝 Checklist Antes do Deploy

Antes de fazer o deploy no Railway, confirme:

- [ ] Código está no GitHub
- [ ] Arquivo `backend/Dockerfile` existe
- [ ] Arquivo `frontend/Dockerfile` existe
- [ ] Arquivo `backend/.env.example` existe
- [ ] Arquivo `frontend/.env.example` existe
- [ ] Arquivo `README.md` com instruções
- [ ] Arquivo `RAILWAY_DEPLOY.md` com guia de deploy
- [ ] `.gitignore` está configurado
- [ ] **NÃO** tem arquivos `.env` no repositório

---

## 🎯 Próximo Passo

Depois de subir no GitHub, siga o guia:
👉 **`RAILWAY_DEPLOY.md`**

---

## 💡 Dicas

### Se você já tem um repositório

```bash
# Adicione as mudanças
git add .

# Commit
git commit -m "Add Docker e Railway config"

# Push
git push origin main
```

### Se precisar criar uma nova branch

```bash
# Criar branch de deploy
git checkout -b deploy

# Adicionar arquivos
git add .

# Commit
git commit -m "Setup para deploy no Railway"

# Push da branch
git push origin deploy
```

---

## ❓ Problemas Comuns

### "Permission denied" ao fazer push

**Solução:** Use token de acesso pessoal do GitHub

1. Acesse: https://github.com/settings/tokens
2. Gere um novo token com permissão de `repo`
3. Use o token como senha quando o Git pedir

### Arquivos grandes não sobem

**Solução:** Verifique o `.gitignore` e remova:
- `node_modules/`
- `build/`
- `dist/`
- `.venv/`

---

**Pronto! Agora você pode seguir para o Railway Deploy! 🚀**
