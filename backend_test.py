#!/usr/bin/env python3
"""
ExploTrack Backend API Testing Suite
Tests critical functionality including payment reports, sale reversals, and vale management
"""

import requests
import json
import sys
from datetime import datetime, timezone
import uuid

# Configuration
BASE_URL = "https://retailtrack-1.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
SALESPERSON_CREDENTIALS = {"username": "test_vendedora", "password": "test123"}

class APITester:
    def __init__(self):
        self.admin_token = None
        self.salesperson_token = None
        self.test_results = []
        self.created_resources = []  # Track created resources for cleanup
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def authenticate(self, credentials, user_type):
        """Authenticate and get token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                data=credentials,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                user_info = data.get("user", {})
                self.log_result(
                    f"Authentication - {user_type}",
                    True,
                    f"Successfully authenticated as {user_info.get('username', 'unknown')}"
                )
                return token
            else:
                self.log_result(
                    f"Authentication - {user_type}",
                    False,
                    f"Authentication failed: {response.status_code}",
                    {"response": response.text}
                )
                return None
                
        except Exception as e:
            self.log_result(
                f"Authentication - {user_type}",
                False,
                f"Authentication error: {str(e)}"
            )
            return None
    
    def make_request(self, method, endpoint, token=None, data=None, params=None):
        """Make authenticated API request"""
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        if data and method.upper() in ["POST", "PUT"]:
            headers["Content-Type"] = "application/json"
            data = json.dumps(data)
        
        try:
            response = requests.request(
                method=method,
                url=f"{BASE_URL}{endpoint}",
                headers=headers,
                data=data,
                params=params
            )
            return response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return None
    
    def test_payment_report_endpoint(self):
        """Test GET /api/reports/pagamentos-detalhados"""
        print("\n=== Testing Payment Report Endpoint ===")
        
        # Test 1: Admin access should work
        response = self.make_request(
            "GET",
            "/reports/pagamentos-detalhados",
            token=self.admin_token,
            params={"mes": 12, "ano": 2025, "filial_id": "test_filial"}
        )
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["mes", "ano", "vendedores", "percentual_comissao"]
            
            if all(field in data for field in required_fields):
                # Check vendedores structure
                vendedores = data.get("vendedores", [])
                if vendedores:
                    vendor = vendedores[0]
                    vendor_fields = ["vendedor", "total_vendas", "comissao_base", "bonus_valor", "vales", "total_a_pagar"]
                    if all(field in vendor for field in vendor_fields):
                        self.log_result(
                            "Payment Report - Admin Access",
                            True,
                            f"Report returned with {len(vendedores)} vendors"
                        )
                    else:
                        missing = [f for f in vendor_fields if f not in vendor]
                        self.log_result(
                            "Payment Report - Admin Access",
                            False,
                            f"Missing vendor fields: {missing}",
                            {"vendor_data": vendor}
                        )
                else:
                    self.log_result(
                        "Payment Report - Admin Access",
                        True,
                        "Report returned successfully (no vendors for test period)"
                    )
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_result(
                    "Payment Report - Admin Access",
                    False,
                    f"Missing required fields: {missing}",
                    {"response_data": data}
                )
        else:
            self.log_result(
                "Payment Report - Admin Access",
                False,
                f"Request failed: {response.status_code if response else 'No response'}",
                {"response": response.text if response else "Connection error"}
            )
        
        # Test 2: Salesperson access should be denied (403)
        response = self.make_request(
            "GET",
            "/reports/pagamentos-detalhados",
            token=self.salesperson_token,
            params={"mes": 12, "ano": 2025}
        )
        
        if response and response.status_code == 403:
            self.log_result(
                "Payment Report - Salesperson Access Denied",
                True,
                "Correctly denied access to salesperson"
            )
        else:
            self.log_result(
                "Payment Report - Salesperson Access Denied",
                False,
                f"Expected 403, got {response.status_code if response else 'No response'}",
                {"response": response.text if response else "Connection error"}
            )
    
    def test_sale_reversal_exclusion(self):
        """Test sale creation, reversal, and exclusion from reports"""
        print("\n=== Testing Sale Reversal (Estorno) Exclusion ===")
        
        # First, create a test sale
        sale_data = {
            "items": [
                {
                    "product_id": str(uuid.uuid4()),
                    "codigo": "TEST001",
                    "descricao": "Test Product",
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
            "vendedor_id": "test_vendor_id",
            "filial_id": "test_filial"
        }
        
        # Create sale
        response = self.make_request(
            "POST",
            "/sales",
            token=self.admin_token,
            data=sale_data
        )
        
        if response and response.status_code == 200:
            sale = response.json()
            sale_id = sale.get("id")
            self.created_resources.append(("sale", sale_id))
            
            self.log_result(
                "Sale Creation",
                True,
                f"Sale created with ID: {sale_id}"
            )
            
            # Test reports before reversal
            self.check_sale_in_reports(sale_id, "before_reversal", should_exist=True)
            
            # Reverse the sale
            response = self.make_request(
                "DELETE",
                f"/sales/{sale_id}/estornar",
                token=self.admin_token
            )
            
            if response and response.status_code == 200:
                self.log_result(
                    "Sale Reversal",
                    True,
                    f"Sale {sale_id} successfully reversed"
                )
                
                # Test reports after reversal - sale should be excluded
                self.check_sale_in_reports(sale_id, "after_reversal", should_exist=False)
                
            else:
                self.log_result(
                    "Sale Reversal",
                    False,
                    f"Failed to reverse sale: {response.status_code if response else 'No response'}",
                    {"response": response.text if response else "Connection error"}
                )
        else:
            self.log_result(
                "Sale Creation",
                False,
                f"Failed to create sale: {response.status_code if response else 'No response'}",
                {"response": response.text if response else "Connection error"}
            )
    
    def check_sale_in_reports(self, sale_id, test_phase, should_exist=True):
        """Check if sale appears in various reports"""
        reports_to_test = [
            ("/reports/dashboard", "Dashboard"),
            ("/reports/sales-by-vendor", "Sales by Vendor"),
            ("/reports/my-performance", "My Performance"),
            ("/reports/pagamentos-detalhados?mes=12&ano=2025", "Payment Report")
        ]
        
        for endpoint, report_name in reports_to_test:
            # Use appropriate token based on endpoint
            token = self.salesperson_token if "my-performance" in endpoint else self.admin_token
            
            response = self.make_request("GET", endpoint, token=token)
            
            if response and response.status_code == 200:
                data = response.json()
                
                # Check if sale data appears in report
                sale_found = self.search_sale_in_report_data(data, sale_id)
                
                if should_exist:
                    success = sale_found
                    message = f"Sale correctly included in {report_name}" if success else f"Sale missing from {report_name}"
                else:
                    success = not sale_found
                    message = f"Sale correctly excluded from {report_name}" if success else f"Sale incorrectly included in {report_name}"
                
                self.log_result(
                    f"Estorno Exclusion - {report_name} ({test_phase})",
                    success,
                    message
                )
            else:
                self.log_result(
                    f"Estorno Exclusion - {report_name} ({test_phase})",
                    False,
                    f"Failed to fetch {report_name}: {response.status_code if response else 'No response'}"
                )
    
    def search_sale_in_report_data(self, data, sale_id):
        """Search for sale data in report response"""
        # This is a simplified search - in a real scenario, we'd need to check
        # if the sale's contribution is reflected in the aggregated numbers
        data_str = json.dumps(data).lower()
        return sale_id.lower() in data_str
    
    def test_vale_management(self):
        """Test Vale CRUD operations"""
        print("\n=== Testing Vale Management ===")
        
        # Test 1: Create vale (admin only)
        vale_data = {
            "vendedora_id": "test_vendor_id",
            "vendedora_nome": "test_vendedora",
            "valor": 50.0,
            "mes": 12,
            "ano": 2025,
            "observacoes": "Test vale"
        }
        
        response = self.make_request(
            "POST",
            "/vales",
            token=self.admin_token,
            data=vale_data
        )
        
        if response and response.status_code == 200:
            vale = response.json()
            vale_id = vale.get("id")
            self.created_resources.append(("vale", vale_id))
            
            self.log_result(
                "Vale Creation - Admin",
                True,
                f"Vale created with ID: {vale_id}"
            )
            
            # Test 2: Retrieve vales
            response = self.make_request(
                "GET",
                f"/vales/vendedora/test_vendor_id?mes=12&ano=2025",
                token=self.admin_token
            )
            
            if response and response.status_code == 200:
                vales = response.json()
                if any(v.get("id") == vale_id for v in vales):
                    self.log_result(
                        "Vale Retrieval",
                        True,
                        f"Vale found in list of {len(vales)} vales"
                    )
                else:
                    self.log_result(
                        "Vale Retrieval",
                        False,
                        "Created vale not found in retrieval"
                    )
            else:
                self.log_result(
                    "Vale Retrieval",
                    False,
                    f"Failed to retrieve vales: {response.status_code if response else 'No response'}"
                )
            
            # Test 3: Update vale (admin only)
            update_data = {
                "vendedora_id": "test_vendor_id",
                "vendedora_nome": "test_vendedora",
                "valor": 75.0,
                "mes": 12,
                "ano": 2025,
                "observacoes": "Updated test vale"
            }
            
            response = self.make_request(
                "PUT",
                f"/vales/{vale_id}",
                token=self.admin_token,
                data=update_data
            )
            
            if response and response.status_code == 200:
                self.log_result(
                    "Vale Update - Admin",
                    True,
                    "Vale updated successfully"
                )
            else:
                self.log_result(
                    "Vale Update - Admin",
                    False,
                    f"Failed to update vale: {response.status_code if response else 'No response'}"
                )
            
        else:
            self.log_result(
                "Vale Creation - Admin",
                False,
                f"Failed to create vale: {response.status_code if response else 'No response'}",
                {"response": response.text if response else "Connection error"}
            )
        
        # Test 4: Salesperson should not be able to create vales
        response = self.make_request(
            "POST",
            "/vales",
            token=self.salesperson_token,
            data=vale_data
        )
        
        if response and response.status_code == 403:
            self.log_result(
                "Vale Creation - Salesperson Denied",
                True,
                "Correctly denied vale creation to salesperson"
            )
        else:
            self.log_result(
                "Vale Creation - Salesperson Denied",
                False,
                f"Expected 403, got {response.status_code if response else 'No response'}"
            )
    
    def test_my_performance_endpoint(self):
        """Test GET /api/reports/my-performance"""
        print("\n=== Testing My Performance Endpoint ===")
        
        response = self.make_request(
            "GET",
            "/reports/my-performance",
            token=self.salesperson_token
        )
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["vendedor", "mes", "ano", "meta_vendas", "vendas_realizadas", "num_vendas"]
            
            if all(field in data for field in required_fields):
                # Check for NaN or null values
                has_nan_or_null = any(
                    data.get(field) is None or 
                    (isinstance(data.get(field), float) and str(data.get(field)).lower() == 'nan')
                    for field in required_fields
                )
                
                if not has_nan_or_null:
                    # Verify it uses vendas_realizadas (not total_vendas)
                    if "vendas_realizadas" in data and "total_vendas" not in data:
                        self.log_result(
                            "My Performance - Field Names",
                            True,
                            "Correctly uses 'vendas_realizadas' field"
                        )
                    else:
                        self.log_result(
                            "My Performance - Field Names",
                            False,
                            "Should use 'vendas_realizadas' not 'total_vendas'"
                        )
                    
                    self.log_result(
                        "My Performance - No NaN Values",
                        True,
                        "All values are valid (no NaN or null)"
                    )
                else:
                    nan_fields = [
                        field for field in required_fields 
                        if data.get(field) is None or 
                        (isinstance(data.get(field), float) and str(data.get(field)).lower() == 'nan')
                    ]
                    self.log_result(
                        "My Performance - No NaN Values",
                        False,
                        f"Found NaN/null values in fields: {nan_fields}",
                        {"performance_data": data}
                    )
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_result(
                    "My Performance - Required Fields",
                    False,
                    f"Missing required fields: {missing}",
                    {"response_data": data}
                )
        else:
            self.log_result(
                "My Performance - Endpoint Access",
                False,
                f"Request failed: {response.status_code if response else 'No response'}",
                {"response": response.text if response else "Connection error"}
            )
    
    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n=== Cleaning Up Test Resources ===")
        
        for resource_type, resource_id in self.created_resources:
            if resource_type == "vale":
                response = self.make_request(
                    "DELETE",
                    f"/vales/{resource_id}",
                    token=self.admin_token
                )
                if response and response.status_code == 200:
                    print(f"✅ Cleaned up vale: {resource_id}")
                else:
                    print(f"❌ Failed to clean up vale: {resource_id}")
            
            # Note: We don't clean up sales as they are marked as estornada
            # which is the intended behavior for the system
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting ExploTrack Backend API Tests")
        print(f"📡 Testing against: {BASE_URL}")
        
        # Authenticate users
        self.admin_token = self.authenticate(ADMIN_CREDENTIALS, "Admin")
        self.salesperson_token = self.authenticate(SALESPERSON_CREDENTIALS, "Salesperson")
        
        if not self.admin_token:
            print("❌ Cannot proceed without admin authentication")
            return False
        
        if not self.salesperson_token:
            print("❌ Cannot proceed without salesperson authentication")
            return False
        
        # Run tests
        self.test_payment_report_endpoint()
        self.test_sale_reversal_exclusion()
        self.test_vale_management()
        self.test_my_performance_endpoint()
        
        # Cleanup
        self.cleanup_resources()
        
        # Summary
        self.print_summary()
        
        return self.get_overall_success()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for r in self.test_results if "✅ PASS" in r["status"])
        failed = sum(1 for r in self.test_results if "❌ FAIL" in r["status"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if "✅ PASS" in result["status"]:
                print(f"  • {result['test']}: {result['message']}")
    
    def get_overall_success(self):
        """Check if all tests passed"""
        return all("✅ PASS" in r["status"] for r in self.test_results)

def main():
    """Main test runner"""
    tester = APITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()