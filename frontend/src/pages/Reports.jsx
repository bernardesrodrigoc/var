import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { reportsAPI, salesAPI } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useFilial } from '@/context/FilialContext';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Download, Calendar, XCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '@/lib/api';

export default function Reports() {
  const [salesByVendor, setSalesByVendor] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const { selectedFilial } = useFilial();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEstornar = user.role === 'admin' || user.role === 'gerente';

  useEffect(() => {
    if (selectedFilial) {
      loadReports();
    }
  }, [selectedMonth, selectedYear, selectedFilial]);

  const loadReports = async () => {
    if (!selectedFilial) return;
    
    try {
      const filialParam = `filial_id=${selectedFilial.id}`;
      
      const [salesData, inventoryData, salesList] = await Promise.all([
        api.get(`/reports/sales-by-vendor?mes=${selectedMonth}&ano=${selectedYear}&${filialParam}`).then(r => r.data),
        api.get(`/reports/inventory-value?${filialParam}`).then(r => r.data),
        api.get(`/sales?${filialParam}`).then(r => r.data),
      ]);

      setSalesByVendor(salesData);
      setInventoryValue(inventoryData);
      // Get last 10 sales
      setRecentSales(salesList.slice(-10).reverse());
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Carregando relatórios...</div>
      </div>
    );
  }

  const totalSales = salesByVendor.reduce((sum, v) => sum + v.total_vendas, 0);
  const totalSalesCount = salesByVendor.reduce((sum, v) => sum + v.num_vendas, 0);
  const totalPiecesCount = salesByVendor.reduce((sum, v) => sum + v.total_pecas, 0);

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-1">Análise de vendas e desempenho</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Vendas</CardTitle>
            <FileText className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalSales)}</div>
            <p className="text-xs text-gray-500 mt-1">{totalSalesCount} vendas realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Peças Vendidas</CardTitle>
            <Download className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPiecesCount}</div>
            <p className="text-xs text-gray-500 mt-1">Unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ticket Médio</CardTitle>
            <Calendar className="w-5 h-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(totalSalesCount > 0 ? totalSales / totalSalesCount : 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Por venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Vendor */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Vendedora</CardTitle>
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
                Nenhuma venda no período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pieces Sold by Vendor */}
        <Card>
          <CardHeader>
            <CardTitle>Peças Vendidas por Vendedora</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByVendor.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesByVendor}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip labelStyle={{ color: '#000' }} />
                  <Bar dataKey="total_pecas" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Nenhuma venda no período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Value */}
      <Card>
        <CardHeader>
          <CardTitle>Valor do Estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Valor de Custo</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(inventoryValue?.valor_custo || 0)}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Valor de Venda</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(inventoryValue?.valor_venda || 0)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Lucro Potencial</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(inventoryValue?.lucro_potencial || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Margem:{' '}
                {inventoryValue?.valor_venda > 0
                  ? ((inventoryValue.lucro_potencial / inventoryValue.valor_venda) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{sale.vendedor}</span>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {sale.modalidade_pagamento}
                    </span>
                    {sale.encomenda && (
                      <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                        Encomenda
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(sale.data)} às {sale.hora}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-indigo-600">{formatCurrency(sale.total)}</p>
                  {sale.parcelas > 1 && (
                    <p className="text-xs text-gray-500">{sale.parcelas}x {formatCurrency(sale.total / sale.parcelas)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {recentSales.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhuma venda registrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
