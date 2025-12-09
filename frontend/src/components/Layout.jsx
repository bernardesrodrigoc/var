import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, TrendingUp, LogOut, Store, Calculator, Send, DollarSign, Building2, ClipboardCheck, MapPin, Settings, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilial } from '@/context/FilialContext';

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { selectedFilial, clearFilial } = useFilial();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearFilial();
    navigate('/login');
  };

  const handleChangeFilial = () => {
    clearFilial();
    navigate('/select-filial');
  };

  // Show performance page for vendedoras
  const showPerformance = user.role === 'vendedora';
  const isAdmin = user.role === 'admin';

  const navigation = [
    ...(!showPerformance ? [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }] : []),
    ...(showPerformance ? [{ name: 'Minhas Metas', href: '/performance', icon: TrendingUp }] : []),
    ...(!showPerformance ? [{ name: 'Produtos', href: '/products', icon: Package }] : []),
    { name: 'Vendas (PDV)', href: '/sales', icon: ShoppingCart },
    { name: 'Clientes', href: '/customers', icon: Users },
    { name: 'Fechamento', href: '/fechamento-caixa', icon: Calculator },
    { name: 'Transferências', href: '/transferencias', icon: Send },
    ...(!showPerformance ? [{ name: 'Relatórios', href: '/reports', icon: TrendingUp }] : []),
    ...(isAdmin ? [{ name: 'Pagamentos', href: '/pagamentos', icon: Wallet }] : []),
    ...(isAdmin ? [{ name: 'Vendedoras', href: '/manage-users', icon: Users }] : []),
    ...(isAdmin ? [{ name: 'Vales', href: '/vales', icon: DollarSign }] : []),
    ...(isAdmin ? [{ name: 'Filiais', href: '/filiais', icon: Building2 }] : []),
    ...(isAdmin ? [{ name: 'Comissões', href: '/comissao-config', icon: Settings }] : []),
    { name: 'Balanço', href: '/balanco-estoque', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">ExploTrack</h1>
              <p className="text-xs text-gray-500">Gestão de Varejo</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                data-testid={`nav-${item.name.toLowerCase()}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* Filial Info */}
          {selectedFilial && (
            <div className="px-4 py-3 border-t border-gray-200 bg-indigo-50">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <p className="text-xs font-medium text-indigo-900">Filial Atual</p>
              </div>
              <p className="text-sm font-bold text-indigo-700 truncate">{selectedFilial.nome}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilial}
                className="mt-2 w-full text-xs"
              >
                Trocar Filial
              </Button>
            </div>
          )}

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                data-testid="logout-button"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Made with Emergent Card */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Made with ❤️ by
              </p>
              <a 
                href="https://emergent.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Emergent
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
