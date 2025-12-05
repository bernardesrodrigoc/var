# 🤖 Prompt para Assistente IA (Gemini/ChatGPT/Claude)

## 📋 Como Usar Este Prompt

1. Copie TODO o conteúdo abaixo (da linha "Início do Prompt" até "Fim do Prompt")
2. Cole no Gemini, ChatGPT ou Claude
3. A IA vai te guiar passo a passo no deploy
4. Responda as perguntas dela conforme avança

---

## ✂️ INÍCIO DO PROMPT (Copie daqui para baixo)

```
Olá! Preciso de ajuda para fazer o deploy de uma aplicação no Railway. Por favor, me guie PASSO A PASSO, perguntando se cada etapa foi concluída antes de avançar para a próxima.

## 📦 Sobre a Aplicação

**Nome:** ExploTrack
**Stack:** FastAPI (Python) + React + MongoDB
**Repositório:** Ainda vou criar/conectar no GitHub

**Estrutura do projeto:**
```
meu-repositorio/
├── backend/        (API FastAPI - porta 8001)
├── frontend/       (React - porta 3000)
└── (arquivos de config na raiz)
```

## 🎯 Objetivo

Fazer deploy completo no Railway com 3 serviços:
1. MongoDB (banco de dados)
2. Backend (API)
3. Frontend (interface)

## 📚 Documentação Disponível

Tenho 3 arquivos de documentação:
- `GITHUB_SETUP.md` - Como preparar o GitHub
- `RAILWAY_DEPLOY.md` - Guia completo do Railway
- `README.md` - Documentação geral

## 🔐 Informações Importantes

**Credenciais padrão após deploy:**
- Usuário: `admin`
- Senha: `admin123`
- Filial criada automaticamente: "Loja Principal"

**Variáveis de ambiente necessárias:**

**Backend:**
- `MONGO_URL` - URL do MongoDB (será copiada do Railway)
- `DB_NAME` - Nome do banco: `explotrack`
- `SECRET_KEY` - Qualquer senha forte que eu inventar
- `CORS_ORIGINS` - Usar: `*`
- `PORT` - Porta: `8001`

**Frontend:**
- `REACT_APP_BACKEND_URL` - URL do backend (será gerada pelo Railway)

## 📝 Meu Nível de Experiência

[ ] Nunca usei Railway antes
[ ] Já usei Railway mas não com multi-serviços
[ ] Conheço Railway mas preciso de orientação
[ ] Outro: _______

## ⚙️ Configurações Especiais

**Root Directories (IMPORTANTE!):**
- Backend: `/backend` (não esquecer!)
- Frontend: `/frontend` (não esquecer!)

**Build/Start Commands:**
- Backend: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Frontend: (automático via Dockerfile)

---

## 🚀 Passo 1: Verificação Inicial

Por favor, me pergunte:

1. Você já tem o código no GitHub? (Sim/Não)
2. Você já tem conta no Railway? (Sim/Não)
3. Qual etapa você quer fazer primeiro?
   - [ ] Subir código no GitHub
   - [ ] Deploy no Railway
   - [ ] Preciso fazer tudo do zero

**Aguardo sua orientação para começar! Por favor, vá devagar e confirme cada etapa comigo antes de avançar.** 🙏

---

## 💡 Instruções Para a IA

Por favor, me guie da seguinte forma:

1. **Pergunte primeiro** qual é minha situação atual
2. **Uma etapa por vez** - não avance sem eu confirmar
3. **Comandos exatos** - me dê os comandos completos para copiar
4. **Checkpoints** - após cada etapa, pergunte se deu certo
5. **Troubleshooting** - se algo falhar, me ajude a debugar
6. **Screenshots** - me diga quando devo tirar prints importantes
7. **URLs para salvar** - me avise quando preciso copiar alguma URL

### Formato de Resposta Ideal:

```
📍 ETAPA X: [Nome da etapa]

🎯 O que vamos fazer:
[Explicação breve]

📝 Comandos/Ações:
[Comandos ou cliques exatos]

✅ Como saber se deu certo:
[O que deve aparecer]

❓ Deu certo? (Responda Sim/Não)
```

**Comece me perguntando sobre minha situação atual!** 🚀
```

---

## ✂️ FIM DO PROMPT

---

## 🎓 Dicas de Uso

### Se o Gemini pedir mais detalhes:

**Sobre o GitHub:**
```
Meu código está em /app
Preciso fazer git init, add, commit e push
Ainda não criei o repositório no GitHub
```

**Sobre o Railway:**
```
Nunca usei Railway antes
Preciso criar conta nova
Quero usar o plano gratuito ($5/mês)
```

**Se der erro:**
```
Mostre a mensagem de erro exata para a IA
Tire screenshot se possível
Peça para a IA te ajudar a debugar
```

### Comandos que você vai precisar (tenha à mão):

**Para GitHub:**
```bash
cd /app
git init
git add .
git commit -m "Deploy: Sistema completo"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

**Para Railway:**
- Você vai fazer pela interface web
- A IA vai te guiar visualmente

---

## 📞 Se Ficar Travado

Use estas frases com a IA:

```
"Não entendi essa parte, pode explicar de forma mais simples?"

"Onde exatamente fico essa opção no Railway?"

"O que devo fazer se [problema específico] acontecer?"

"Pode me dar um exemplo visual ou mais detalhes?"

"Antes de continuar, vamos revisar o que já foi feito?"
```

---

## ✅ Checklist de Progresso

Use para acompanhar seu progresso com a IA:

### GitHub
- [ ] Repositório criado no GitHub
- [ ] Código commitado localmente
- [ ] Código enviado para o GitHub
- [ ] Repositório visível no GitHub

### Railway - MongoDB
- [ ] Conta Railway criada
- [ ] Projeto Railway criado
- [ ] MongoDB provisionado
- [ ] MONGO_URL copiada

### Railway - Backend
- [ ] Serviço backend adicionado
- [ ] Root Directory configurado: `/backend`
- [ ] Variáveis de ambiente adicionadas
- [ ] Deploy bem-sucedido (ícone verde)
- [ ] Domain gerada e copiada

### Railway - Frontend
- [ ] Serviço frontend adicionado
- [ ] Root Directory configurado: `/frontend`
- [ ] REACT_APP_BACKEND_URL configurada
- [ ] Deploy bem-sucedido (ícone verde)
- [ ] Domain gerada
- [ ] Site acessível
- [ ] Login funciona com admin/admin123

---

## 🎯 Resultado Final Esperado

Quando tudo estiver pronto, você deve ter:

1. ✅ 3 "caixinhas" verdes no Railway
2. ✅ URL do frontend acessível
3. ✅ Login funcionando
4. ✅ Sistema carregando sem erros

---

## 🆘 Problemas Comuns

Se a IA mencionar estes problemas:

**"Build failed"**
→ Peça para verificar os logs
→ Pode ser Root Directory errado

**"502 Bad Gateway"**
→ Backend ainda está subindo
→ Aguarde 1-2 minutos

**"CORS Error"**
→ Verifique se CORS_ORIGINS=* no backend
→ Verifique se REACT_APP_BACKEND_URL está correto

**"Can't connect to MongoDB"**
→ Verifique se MONGO_URL foi copiada corretamente
→ Certifique-se que tem o protocolo mongodb://

---

## 💬 Exemplo de Conversa

**Você:**
[Cola o prompt acima]

**IA:**
"Olá! Vou te ajudar com o deploy. Primeiro, você já tem o código no GitHub?"

**Você:**
"Não, ainda não."

**IA:**
"Ok! Vamos começar subindo o código. Você está no diretório /app?"

**Você:**
"Sim"

**IA:**
"Ótimo! Execute estes comandos..."

[E assim por diante...]

---

**Boa sorte com o deploy! 🚀**
