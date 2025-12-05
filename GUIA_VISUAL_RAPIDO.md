# 🎨 Guia Visual Rápido - Deploy Railway

## 📱 Como Usar

Este é um guia super visual e simplificado. Use junto com o Gemini ou sozinho!

---

## 🎯 FASE 1: GitHub (5 minutos)

### Passo 1.1: Criar Repositório
```
1. Abra: https://github.com
2. Clique no botão verde: "+ New repository"
3. Nome: explotrack (ou o que quiser)
4. Public ou Private: tanto faz
5. NÃO marque "Add README"
6. Clique: "Create repository"
```

### Passo 1.2: Conectar seu Código
```bash
# Execute no terminal (na pasta /app):

cd /app

# 1. Inicializar Git
git init

# 2. Adicionar tudo
git add .

# 3. Commit
git commit -m "Initial commit: ExploTrack completo"

# 4. Conectar ao GitHub (troque SEU-USUARIO e SEU-REPO)
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git

# 5. Enviar
git branch -M main
git push -u origin main
```

### ✅ Como Saber se Deu Certo
- Recarregue a página do GitHub
- Você deve ver pastas: `backend/`, `frontend/`, `README.md`

---

## 🎯 FASE 2: Railway - MongoDB (3 minutos)

### Passo 2.1: Criar Conta
```
1. Abra: https://railway.app
2. Clique: "Login" ou "Start a New Project"
3. Escolha: "Login with GitHub"
4. Autorize o Railway
```

### Passo 2.2: Criar Projeto
```
1. Clique no botão: "+ New Project"
2. Escolha: "Provision MongoDB"
3. Aguarde aparecer um cartão roxo/azul com "MongoDB"
```

### Passo 2.3: Copiar MONGO_URL (IMPORTANTE!)
```
1. Clique no cartão "MongoDB"
2. Procure a aba: "Variables" ou "Connect"
3. Procure a variável: MONGO_URL
4. Clique no botão copiar (ícone 📋)
5. Cole em um bloco de notas! Você vai precisar!
```

**MONGO_URL parece com:**
```
mongodb://mongo:SENHA123@containers-us-west-xyz.railway.app:1234
```

---

## 🎯 FASE 3: Railway - Backend (5 minutos)

### Passo 3.1: Adicionar Backend
```
1. No mesmo projeto, clique: "+ New"
2. Escolha: "GitHub Repo"
3. Se pedir autorização, autorize
4. Selecione: seu repositório (explotrack)
```

Vai aparecer um cartão com o nome do repo. Provavelmente vai estar vermelho (FALHANDO) - é normal!

### Passo 3.2: Configurar Root Directory
```
1. Clique no cartão do backend (o que acabou de criar)
2. Vá em: "Settings" (ícone de engrenagem)
3. Procure: "Root Directory"
4. Digite: backend
5. Aguarde redesign automático
```

### Passo 3.3: Adicionar Variáveis
```
1. Ainda no mesmo serviço, clique na aba: "Variables"
2. Clique: "+ New Variable"
3. Adicione UMA POR VEZ:
```

| Nome da Variável | Valor |
|------------------|-------|
| `MONGO_URL` | Cole a URL que você copiou do MongoDB |
| `DB_NAME` | `explotrack` |
| `SECRET_KEY` | Invente algo: `minha-senha-super-secreta-123` |
| `CORS_ORIGINS` | `*` |
| `PORT` | `8001` |

### Passo 3.4: Gerar URL do Backend
```
1. Ainda em Settings
2. Procure: "Networking"
3. Clique: "Generate Domain"
4. Vai aparecer algo como: backend-production-abc123.up.railway.app
5. COPIE E SALVE essa URL! (sem https://, só o endereço)
```

### ✅ Como Saber se Deu Certo
- O cartão do backend ficou VERDE
- Quando clica, pode ver logs rodando
- Não tem erros vermelhos nos logs

---

## 🎯 FASE 4: Railway - Frontend (5 minutos)

### Passo 4.1: Adicionar Frontend
```
1. No projeto Railway, clique: "+ New" novamente
2. Escolha: "GitHub Repo"
3. Selecione: O MESMO repositório (explotrack)
```

Vai criar um SEGUNDO cartão. Normal ter dois!

### Passo 4.2: Configurar Root Directory
```
1. Clique no NOVO cartão (não no backend!)
2. Vá em: "Settings"
3. Procure: "Root Directory"
4. Digite: frontend
5. Aguarde redesign
```

### Passo 4.3: Adicionar Variável do Frontend
```
1. Clique na aba: "Variables"
2. Clique: "+ New Variable"
3. Nome: REACT_APP_BACKEND_URL
4. Valor: Cole a URL do backend que você salvou
```

**IMPORTANTE:** O valor deve ser:
```
https://backend-production-abc123.up.railway.app
```
(COM `https://` na frente, SEM `/` no final)

### Passo 4.4: Gerar URL do Frontend
```
1. Volte em: "Settings"
2. Procure: "Networking"
3. Clique: "Generate Domain"
4. Vai aparecer: frontend-production-xyz789.up.railway.app
5. Anote mas não precisa copiar agora
```

### ✅ Como Saber se Deu Certo
- Cartão do frontend ficou VERDE
- Clique na URL gerada
- Site abre no navegador!

---

## 🎯 FASE 5: Testar o Sistema (2 minutos)

### Passo 5.1: Acessar o Site
```
1. Clique na URL do frontend no Railway
   OU
2. Digite a URL no navegador
```

### Passo 5.2: Fazer Login
```
Usuário: admin
Senha: admin123
```

### Passo 5.3: Selecionar Filial
```
1. Vai aparecer uma tela: "Selecione a Filial"
2. Clique em: "Selecionar" na filial "Loja Principal"
```

### ✅ Sucesso Total!
Você está dentro do sistema! 🎉

Se chegou aqui, parabéns! Deploy completo!

---

## 🎨 Diagrama Visual

```
┌─────────────────────────────────────────┐
│         SEU PROJETO RAILWAY             │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │ MongoDB  │  │ Backend  │  │ Front│ │
│  │  (roxo)  │──│ (verde)  │──│(verde│ │
│  └──────────┘  └──────────┘  └──────┘ │
│       ↓              ↓           ↓     │
│   [Banco]      [API 8001]   [Site 80] │
│                                         │
│   MONGO_URL        ↓                   │
│       └───────→ [Backend]              │
│                     ↓                  │
│              BACKEND_URL               │
│                     └────→ [Frontend]  │
└─────────────────────────────────────────┘
```

---

## 🆘 Problemas Comuns

### ❌ Cartão Vermelho (Failed)

**Sintomas:** Cartão do backend ou frontend fica vermelho

**Checklist:**
- [ ] Root Directory está correto? (`backend` ou `frontend`)
- [ ] Variáveis foram adicionadas?
- [ ] MONGO_URL tem o valor completo?
- [ ] BACKEND_URL no frontend tem `https://`?

**Como Resolver:**
1. Clique no cartão vermelho
2. Vá em "Deployments"
3. Clique no último deploy
4. Clique em "View Logs"
5. Procure por "ERROR" nas últimas linhas
6. Cole o erro no Gemini e peça ajuda

---

### ❌ Site Não Abre (502 Bad Gateway)

**Sintomas:** URL do frontend mostra erro 502

**Razões:**
- Backend ainda está subindo (aguarde 2 minutos)
- Backend falhou (verifique se está verde)
- CORS não configurado

**Como Resolver:**
1. Verifique se backend está VERDE
2. Aguarde 2 minutos e recarregue
3. Se persistir, verifique CORS_ORIGINS=* no backend

---

### ❌ Login Não Funciona

**Sintomas:** Digita admin/admin123 mas não entra

**Como Resolver:**
1. Abra o console do navegador (F12)
2. Vá na aba "Network"
3. Tente fazer login
4. Procure por requests para `/api/auth/login`
5. Se aparecer CORS error:
   - Verifique CORS_ORIGINS no backend
   - Verifique REACT_APP_BACKEND_URL no frontend

---

### ❌ Tela Branca

**Sintomas:** Site abre mas fica branco

**Como Resolver:**
1. F12 → Console
2. Procure erros vermelhos
3. Geralmente é REACT_APP_BACKEND_URL errada
4. Vá no Railway → Frontend → Variables
5. Verifique se a URL está EXATAMENTE assim:
   ```
   https://seu-backend.up.railway.app
   ```
   (SEM `/` no final!)

---

## 📞 Comandos Úteis

### Ver Status do Deploy
```
No Railway:
1. Clique no cartão
2. Aba "Deployments"
3. Veja o status: Building → Deploying → Success
```

### Forçar Redeploy
```
1. Clique no cartão
2. Aba "Deployments"
3. Botão "⋯" no último deploy
4. "Redeploy"
```

### Ver Logs em Tempo Real
```
1. Clique no cartão
2. Aba "Deployments"
3. Clique no deploy ativo
4. "View Logs"
```

---

## ✅ Checklist Final

Marque conforme avança:

- [ ] Código no GitHub ✅
- [ ] Projeto Railway criado ✅
- [ ] MongoDB provisionado (roxo) ✅
- [ ] MONGO_URL copiada ✅
- [ ] Backend adicionado ✅
- [ ] Backend root: `/backend` ✅
- [ ] Backend com 5 variáveis ✅
- [ ] Backend VERDE ✅
- [ ] Backend URL gerada e copiada ✅
- [ ] Frontend adicionado ✅
- [ ] Frontend root: `/frontend` ✅
- [ ] Frontend com 1 variável ✅
- [ ] Frontend VERDE ✅
- [ ] Frontend URL gerada ✅
- [ ] Site abre no navegador ✅
- [ ] Login funciona ✅
- [ ] Dashboard carrega ✅

---

**Se todos estiverem marcados: PARABÉNS! 🎉**

Seu sistema está no ar e funcionando!

---

## 🎓 Próximos Passos

Depois que estiver funcionando:

1. **Trocar senha do admin**
   - Faça login
   - Crie um novo usuário admin com senha forte
   - Delete o usuário `admin` padrão

2. **Configurar domínio próprio** (opcional)
   - Railway permite domínios customizados
   - Veja: Settings → Networking → Custom Domain

3. **Monitorar uso**
   - Railway mostra uso na dashboard
   - $5/mês grátis
   - Depois disso, ~$5-10/mês

4. **Updates automáticos**
   - Qualquer `git push` = novo deploy automático!
   - Teste em branch separada antes

---

**Boa sorte! 🚀**
