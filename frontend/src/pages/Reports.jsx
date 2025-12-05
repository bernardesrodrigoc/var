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
  
  // Date range - default to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const [dataInicio, setDataInicio] = useState(firstDay.toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(lastDay.toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const { selectedFilial } = useFilial();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEstornar = user.role === 'admin' || user.role === 'gerente';

  useEffect(() => {
    if (selectedFilial) {
      loadReports();
    }
  }, [dataInicio, dataFim, selectedFilial]);

  const loadReports = async () => {
    if (!selectedFilial) return;
    
    try {
      const filialParam = `filial_id=${selectedFilial.id}`;
      
      const [salesData, inventoryData, salesList] = await Promise.all([
        api.get(`/reports/sales-by-vendor?data_inicio=${dataInicio}&data_fim=${dataFim}&${filialParam}`).then(r => r.data),
        api.get(`/reports/inventory-value?${filialParam}`).then(r => r.data),
        api.get(`/sales?${filialParam}`).then(r => r.data),
      ]);

      setSalesByVendor(salesData);
      setInventoryValue(inventoryData);
      
      // Filter sales by date range
      const filteredSales = salesList.filter(sale => {
        const saleDate = sale.data.split('T')[0];
        return saleDate >= dataInicio && saleDate <= dataFim;
      });
      
      setRecentSales(filteredSales.slice(-10).reverse());
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEstornar = async (saleId, saleData) => {
    const confirmMessage = `Tem certeza que deseja estornar esta venda?

Vendedor: ${saleData.vendedor}
Valor: ${formatCurrency(saleData.total)}
Itens: ${saleData.items.length}

Os produtos retornarão ao estoque e a venda será marcada como ESTORNADA.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await api.delete(`/sales/${saleId}/estornar`);
      toast({
        title: 'Venda estornada com sucesso!',
        description: `${response.data.produtos_devolvidos} produtos devolvidos. Valor: ${formatCurrency(response.data.valor_estornado)}`,
      });
      // Recarregar todos os dados para atualizar dashboard e relatórios
      loadReports();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao estornar',
        description: error.response?.data?.detail || 'Não foi possível estornar a venda',
      });
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
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">De:</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Até:</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
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
                    <p className="font-medium text-gray-900">{sale.vendedor}</p>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                      {sale.modalidade_pagamento}
                    </span>
                    {sale.estornada && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        ESTORNADA
                      </span>
                    )}
                    {sale.is_troca && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        Troca
                      </span>
                    )}
                    {sale.online && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Online
                      </span>
                    )}
                    {sale.encomenda && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
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
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${sale.estornada ? 'text-red-600 line-through' : 'text-indigo-600'}`}>
                      {formatCurrency(sale.total)}
                    </p>
                    {sale.parcelas > 1 && (
                      <p className="text-xs text-gray-500">{sale.parcelas}x {formatCurrency(sale.total / sale.parcelas)}</p>
                    )}
                  </div>
                  {canEstornar && !sale.estornada && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEstornar(sale.id, sale)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Estornar venda"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </Button>
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
