import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useFilial } from '@/context/FilialContext';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Download, Calendar, XCircle, AlertTriangle, DollarSign, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

export default function Reports() {
  const [salesByVendor, setSalesByVendor] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [allSales, setAllSales] = useState([]);
  
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
      setLoading(true);
      const filialParam = `filial_id=${selectedFilial.id}`;
      const fimDoDia = `${dataFim}T23:59:59`;
      
      const [salesData, inventoryData, salesList] = await Promise.all([
        api.get(`/reports/sales-by-vendor?data_inicio=${dataInicio}&data_fim=${dataFim}&${filialParam}`).then(r => r.data),
        api.get(`/reports/inventory-value?${filialParam}`).then(r => r.data),
        api.get(`/sales?${filialParam}&data_inicio=${dataInicio}&data_fim=${fimDoDia}&limit=5000`).then(r => r.data),
      ]);

      setSalesByVendor(salesData);
      setInventoryValue(inventoryData);
      setAllSales(salesList);
      
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
      });
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
      loadReports();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao estornar',
        description: error.response?.data?.detail || 'Não foi possível estornar a venda',
      });
    }
  };

  // --- CÁLCULO DOS TOTAIS POR PAGAMENTO ---
  const paymentTotals = allSales.reduce((acc, sale) => {
    // Ignora estornos e trocas (que não geram caixa)
    if (sale.estornada || sale.is_troca) return acc;

    if (sale.modalidade_pagamento === 'Misto' && sale.pagamentos) {
      // Se for misto, soma cada parcela individualmente
      sale.pagamentos.forEach(p => {
        const mode = p.modalidade;
        acc[mode] = (acc[mode] || 0) + p.valor;
      });
    } else {
      // Se for único, soma o total na modalidade
      const mode = sale.modalidade_pagamento;
      acc[mode] = (acc[mode] || 0) + sale.total;
    }
    return acc;
  }, { Dinheiro: 0, Pix: 0, Cartao: 0, Credito: 0 });
  // ----------------------------------------

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-1">Análise de vendas e desempenho</p>
        </div>
        <div className="flex gap-3 items-center bg-white p-2 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">De:</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2 py-1 border rounded-md text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Até:</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2 py-1 border rounded-md text-sm"
            />
          </div>
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

      {/* --- NOVA SEÇÃO: DETALHAMENTO POR PAGAMENTO --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Dinheiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-700">{formatCurrency(paymentTotals.Dinheiro || 0)}</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Pix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-700">{formatCurrency(paymentTotals.Pix || 0)}</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Cartão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-700">{formatCurrency(paymentTotals.Cartao || 0)}</div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Crédito (Fiado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-700">{formatCurrency(paymentTotals.Credito || 0)}</div>
          </CardContent>
        </Card>
      </div>
      {/* ----------------------------------------------- */}

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
                  <Tooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: '#000' }} />
                  <Bar dataKey="total_vendas" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Nenhuma venda no período
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
                Nenhuma venda no período
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

      {/* Sales History List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas ({allSales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {allSales.length > 0 ? (
            <div className="h-[600px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {allSales.map((sale) => (
                <div key={sale.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors">
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold text-gray-900 text-lg">{sale.vendedor}</p>
                      
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                        {sale.modalidade_pagamento}
                      </span>
                      
                      {sale.estornada && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1 font-bold border border-red-200">
                          <XCircle className="w-3 h-3" />
                          ESTORNADA
                        </span>
                      )}
                      {sale.is_troca && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-200 font-medium">
                          Troca
                        </span>
                      )}
                      {sale.online && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full border border-green-200">
                          Online
                        </span>
                      )}
                      {sale.encomenda && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full border border-purple-200">
                          Encomenda
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between md:justify-start md:gap-8 mt-2 text-sm text-gray-600">
                      <span>{formatDate(sale.data)} às {sale.hora}</span>
                      <span>
                        {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                      </span>
                      {sale.cliente_nome && (
                        <span className="font-medium text-gray-800">Cliente: {sale.cliente_nome}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between w-full md:w-auto gap-4 mt-3 md:mt-0">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${sale.estornada ? 'text-red-600 line-through decoration-2' : 'text-indigo-600'}`}>
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
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
                        title="Estornar venda (cancelar)"
                      >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Estornar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
              <p>Nenhuma venda registrada neste período.</p>
              <p className="text-sm mt-1">Tente mudar as datas no topo da página.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
