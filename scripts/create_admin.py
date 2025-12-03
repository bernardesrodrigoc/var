#!/usr/bin/env python3
"""
Script para criar usuário administrador inicial
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(Path(__file__).parent.parent / 'backend' / '.env')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin_user():
    """Create admin user if it doesn't exist"""
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check if admin exists
    existing_admin = await db.users.find_one({"username": "admin"})
    
    if existing_admin:
        print("✓ Usuário admin já existe")
        client.close()
        return
    
    # Create admin user
    admin_user = {
        "id": "admin-001",
        "username": "admin",
        "full_name": "Administrador",
        "role": "admin",
        "active": True,
        "hashed_password": pwd_context.hash("admin123"),
        "created_at": "2024-01-01T00:00:00Z"
    }
    
    await db.users.insert_one(admin_user)
    print("✓ Usuário admin criado com sucesso!")
    print("  Username: admin")
    print("  Senha: admin123")
    print("\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin_user())
