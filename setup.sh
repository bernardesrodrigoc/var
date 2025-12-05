#!/bin/bash

echo "🚀 ExploTrack - Setup Script"
echo "=============================="
echo ""

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Criando backend/.env..."
    cp backend/.env.example backend/.env
    echo "✅ backend/.env criado!"
    echo "⚠️  IMPORTANTE: Edite backend/.env e configure as variáveis!"
else
    echo "✅ backend/.env já existe"
fi

if [ ! -f "frontend/.env" ]; then
    echo "📝 Criando frontend/.env..."
    cp frontend/.env.example frontend/.env
    echo "✅ frontend/.env criado!"
    echo "⚠️  IMPORTANTE: Edite frontend/.env e configure REACT_APP_BACKEND_URL!"
else
    echo "✅ frontend/.env já existe"
fi

echo ""
echo "=============================="
echo "✅ Setup completo!"
echo ""
echo "📚 Próximos passos:"
echo ""
echo "Para rodar com Docker:"
echo "  docker-compose up -d"
echo ""
echo "Para deploy no Railway:"
echo "  Leia o arquivo RAILWAY_DEPLOY.md"
echo ""
echo "Acesso padrão:"
echo "  Usuário: admin"
echo "  Senha: admin123"
echo ""
