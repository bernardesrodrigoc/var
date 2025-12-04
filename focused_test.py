#!/usr/bin/env python3
"""
Focused test for critical ExploTrack functionality
"""

import requests
import json
import time

BASE_URL = "https://retailtrack-1.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
SALESPERSON_CREDENTIALS = {"username": "test_vendedora", "password": "test123"}

def get_token(credentials):
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data=credentials,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10
    )
    return response.json().get("access_token") if response.status_code == 200 else None

def test_critical_functionality():
    """Test the most critical functionality"""
    print("=== Critical Functionality Test ===")
    
    admin_token = get_token(ADMIN_CREDENTIALS)
    salesperson_token = get_token(SALESPERSON_CREDENTIALS)
    
    results = []
    
    # Test 1: Payment Report Access Control
    print("\n1. Testing Payment Report Access Control...")
    
    # Admin should have access
    response = requests.get(
        f"{BASE_URL}/reports/pagamentos-detalhados",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"mes": 12, "ano": 2025},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        if "vendedores" in data and "percentual_comissao" in data:
            results.append("✅ Payment Report - Admin Access: PASS")
        else:
            results.append("❌ Payment Report - Admin Access: Missing required fields")
    else:
        results.append(f"❌ Payment Report - Admin Access: {response.status_code}")
    
    # Salesperson should be denied
    try:
        response = requests.get(
            f"{BASE_URL}/reports/pagamentos-detalhados",
            headers={"Authorization": f"Bearer {salesperson_token}"},
            params={"mes": 12, "ano": 2025},
            timeout=10
        )
        
        if response.status_code == 403:
            results.append("✅ Payment Report - Salesperson Denied: PASS")
        else:
            results.append(f"❌ Payment Report - Salesperson Denied: Got {response.status_code}, expected 403")
    except Exception as e:
        results.append(f"❌ Payment Report - Salesperson Denied: Connection error - {e}")
    
    # Test 2: My Performance Endpoint
    print("\n2. Testing My Performance Endpoint...")
    
    response = requests.get(
        f"{BASE_URL}/reports/my-performance",
        headers={"Authorization": f"Bearer {salesperson_token}"},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        required_fields = ["vendedor", "vendas_realizadas", "num_vendas", "meta_vendas"]
        
        if all(field in data for field in required_fields):
            # Check for NaN values
            has_nan = any(
                data.get(field) is None or 
                (isinstance(data.get(field), (int, float)) and str(data.get(field)).lower() == 'nan')
                for field in required_fields
            )
            
            if not has_nan:
                results.append("✅ My Performance - No NaN Values: PASS")
            else:
                results.append("❌ My Performance - Has NaN Values: FAIL")
            
            # Check field names
            if "vendas_realizadas" in data and "total_vendas" not in data:
                results.append("✅ My Performance - Correct Field Names: PASS")
            else:
                results.append("❌ My Performance - Wrong Field Names: Should use 'vendas_realizadas'")
        else:
            missing = [f for f in required_fields if f not in data]
            results.append(f"❌ My Performance - Missing Fields: {missing}")
    else:
        results.append(f"❌ My Performance - Request Failed: {response.status_code}")
    
    # Test 3: Vale Management Access Control
    print("\n3. Testing Vale Management Access Control...")
    
    vale_data = {
        "vendedora_id": "test_id",
        "vendedora_nome": "test",
        "valor": 50.0,
        "mes": 12,
        "ano": 2025
    }
    
    # Admin should be able to create vales
    response = requests.post(
        f"{BASE_URL}/vales",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        },
        data=json.dumps(vale_data),
        timeout=10
    )
    
    if response.status_code == 200:
        vale = response.json()
        vale_id = vale.get("id")
        results.append("✅ Vale Creation - Admin: PASS")
        
        # Clean up
        requests.delete(
            f"{BASE_URL}/vales/{vale_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
    else:
        results.append(f"❌ Vale Creation - Admin: {response.status_code}")
    
    # Salesperson should be denied
    try:
        response = requests.post(
            f"{BASE_URL}/vales",
            headers={
                "Authorization": f"Bearer {salesperson_token}",
                "Content-Type": "application/json"
            },
            data=json.dumps(vale_data),
            timeout=10
        )
        
        if response.status_code == 403:
            results.append("✅ Vale Creation - Salesperson Denied: PASS")
        else:
            results.append(f"❌ Vale Creation - Salesperson Denied: Got {response.status_code}, expected 403")
    except Exception as e:
        results.append(f"❌ Vale Creation - Salesperson Denied: Connection error - {e}")
    
    # Test 4: Sale Reversal Functionality
    print("\n4. Testing Sale Reversal Functionality...")
    
    # Create a product first
    product_data = {
        "codigo": "TESTREV001",
        "descricao": "Test Reversal Product",
        "quantidade": 10,
        "preco_custo": 50.0,
        "preco_venda": 100.0,
        "filial_id": "test_filial"
    }
    
    response = requests.post(
        f"{BASE_URL}/products",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        },
        data=json.dumps(product_data),
        timeout=10
    )
    
    if response.status_code == 200:
        product = response.json()
        product_id = product.get("id")
        
        # Create a sale
        sale_data = {
            "items": [
                {
                    "product_id": product_id,
                    "codigo": "TESTREV001",
                    "descricao": "Test Reversal Product",
                    "quantidade": 1,
                    "preco_venda": 100.0,
                    "preco_custo": 50.0,
                    "subtotal": 100.0
                }
            ],
            "total": 100.0,
            "modalidade_pagamento": "Dinheiro",
            "parcelas": 1,
            "desconto": 0.0,
            "vendedor": "test_vendedora",
            "filial_id": "test_filial"
        }
        
        response = requests.post(
            f"{BASE_URL}/sales",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            data=json.dumps(sale_data),
            timeout=10
        )
        
        if response.status_code == 200:
            sale = response.json()
            sale_id = sale.get("id")
            results.append("✅ Sale Creation for Reversal Test: PASS")
            
            # Reverse the sale
            response = requests.delete(
                f"{BASE_URL}/sales/{sale_id}/estornar",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=10
            )
            
            if response.status_code == 200:
                results.append("✅ Sale Reversal (Estorno): PASS")
                
                # Verify sale is marked as estornada
                response = requests.get(
                    f"{BASE_URL}/sales/{sale_id}",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    sale_data = response.json()
                    if sale_data.get("estornada") == True:
                        results.append("✅ Sale Marked as Estornada: PASS")
                    else:
                        results.append("❌ Sale Marked as Estornada: FAIL")
                else:
                    results.append("❌ Sale Verification: Failed to retrieve sale")
            else:
                results.append(f"❌ Sale Reversal (Estorno): {response.status_code}")
        else:
            results.append(f"❌ Sale Creation for Reversal Test: {response.status_code}")
        
        # Clean up product
        requests.delete(
            f"{BASE_URL}/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
    else:
        results.append(f"❌ Product Creation for Reversal Test: {response.status_code}")
    
    # Print results
    print("\n" + "="*60)
    print("CRITICAL FUNCTIONALITY TEST RESULTS")
    print("="*60)
    
    passed = sum(1 for r in results if r.startswith("✅"))
    total = len(results)
    
    for result in results:
        print(result)
    
    print(f"\nSUMMARY: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    return passed == total

if __name__ == "__main__":
    success = test_critical_functionality()
    exit(0 if success else 1)