#!/usr/bin/env python3
"""
Debug test to check specific connection issues
"""

import requests
import json

BASE_URL = "https://retailtrack-1.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
SALESPERSON_CREDENTIALS = {"username": "test_vendedora", "password": "test123"}

def get_token(credentials):
    """Get authentication token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            data=credentials,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            print(f"Auth failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Auth error: {e}")
        return None

def test_endpoint(endpoint, token, method="GET", data=None, params=None):
    """Test a specific endpoint"""
    headers = {"Authorization": f"Bearer {token}"}
    if data:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data)
    
    try:
        response = requests.request(
            method=method,
            url=f"{BASE_URL}{endpoint}",
            headers=headers,
            data=data,
            params=params,
            timeout=10
        )
        print(f"{method} {endpoint}: {response.status_code}")
        if response.status_code >= 400:
            print(f"  Error: {response.text}")
        return response
    except Exception as e:
        print(f"{method} {endpoint}: ERROR - {e}")
        return None

def main():
    print("=== Debug Test ===")
    
    # Get tokens
    admin_token = get_token(ADMIN_CREDENTIALS)
    salesperson_token = get_token(SALESPERSON_CREDENTIALS)
    
    if not admin_token or not salesperson_token:
        print("Failed to get tokens")
        return
    
    print(f"Admin token: {admin_token[:20]}...")
    print(f"Salesperson token: {salesperson_token[:20]}...")
    
    # Test problematic endpoints
    print("\n=== Testing Problematic Endpoints ===")
    
    # Test salesperson access to payment report (should be 403)
    test_endpoint("/reports/pagamentos-detalhados", salesperson_token, params={"mes": 12, "ano": 2025})
    
    # Test sale creation with minimal data
    sale_data = {
        "items": [],
        "total": 0.0,
        "modalidade_pagamento": "Dinheiro",
        "parcelas": 1,
        "desconto": 0.0,
        "vendedor": "test_vendedora",
        "filial_id": "test_filial"
    }
    test_endpoint("/sales", admin_token, method="POST", data=sale_data)
    
    # Test vale creation by salesperson (should be 403)
    vale_data = {
        "vendedora_id": "test_id",
        "vendedora_nome": "test",
        "valor": 50.0,
        "mes": 12,
        "ano": 2025
    }
    test_endpoint("/vales", salesperson_token, method="POST", data=vale_data)

if __name__ == "__main__":
    main()