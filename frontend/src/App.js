import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import SelectFilial from '@/pages/SelectFilial';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Sales from '@/pages/Sales';
import Customers from '@/pages/Customers';
import Reports from '@/pages/Reports';
import MyPerformance from '@/pages/MyPerformance';
import ManageUsers from '@/pages/ManageUsers';
import FechamentoCaixa from '@/pages/FechamentoCaixa';
import Vales from '@/pages/Vales';
import Transferencias from '@/pages/Transferencias';
import Filiais from '@/pages/Filiais';
import BalancoEstoque from '@/pages/BalancoEstoque';
import ComissaoConfig from '@/pages/ComissaoConfig';
import { FilialProvider } from '@/context/FilialContext';
import { Toaster } from '@/components/ui/toaster';
import '@/App.css';

// Protected Route Component
function ProtectedRoute({ children, requireFilial = false }) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireFilial) {
    const selectedFilial = localStorage.getItem('selected_filial');
    if (!selectedFilial) {
      return <Navigate to="/select-filial" replace />;
    }
  }
  
  return children;
}

function App() {
  return (
    <>
      <BrowserRouter>
        <FilialProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/select-filial" 
              element={
                <ProtectedRoute>
                  <SelectFilial />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/"
              element={
                <ProtectedRoute requireFilial={true}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="performance" element={<MyPerformance />} />
              <Route path="products" element={<Products />} />
              <Route path="sales" element={<Sales />} />
              <Route path="customers" element={<Customers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="manage-users" element={<ManageUsers />} />
              <Route path="fechamento-caixa" element={<FechamentoCaixa />} />
              <Route path="vales" element={<Vales />} />
              <Route path="transferencias" element={<Transferencias />} />
              <Route path="filiais" element={<Filiais />} />
              <Route path="balanco-estoque" element={<BalancoEstoque />} />
            </Route>
          </Routes>
        </FilialProvider>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
