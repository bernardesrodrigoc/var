import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { reportsAPI, goalsAPI, salesAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Package, TrendingUp, Users, ShoppingCart, Target, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [salesByVendor, setSalesByVendor] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, salesData, inventoryData] = await Promise.all([
        reportsAPI.getDashboard(),
        reportsAPI.getSalesByVendor(currentMonth, currentYear),
        reportsAPI.getInventoryValue(),
      ]);

      setStats(statsData);
      setSalesByVendor(salesData);
      setInventoryValue(inventoryData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Carregando...</div>
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Vendas Hoje',
      value: stats?.sales_today || 0,
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      title: 'Receita Hoje',
      value: formatCurrency(stats?.revenue_today || 0),
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      title: 'Total Produtos',
      value: stats?.total_products || 0,
      icon: Package,
      color: 'bg-purple-500',
    },
    {
      title: 'Total Clientes',
      value: stats?.total_customers || 0,
      icon: Users,
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.title} data-testid={`stat-card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-value-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Vendor */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Vendedora (Mês Atual)</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByVendor.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesByVendor}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Bar dataKey="total_vendas" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Nenhuma venda registrada este mês
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Value */}
        <Card>
          <CardHeader>
            <CardTitle>Valor do Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Valor de Custo</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(inventoryValue?.valor_custo || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Valor de Venda</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(inventoryValue?.valor_venda || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Lucro Potencial</span>
                <span className="text-lg font-bold text-purple-600">
                  {formatCurrency(inventoryValue?.lucro_potencial || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Vendor */}
      {salesByVendor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Desempenho das Vendedoras (Mês Atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesByVendor.map((vendor, index) => (
                <div key={vendor._id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900">{vendor._id}</span>
                      <span className="text-sm font-bold text-indigo-600">
                        {formatCurrency(vendor.total_vendas)}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{vendor.num_vendas} vendas</span>
                      <span>•</span>
                      <span>{vendor.total_pecas} peças vendidas</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
