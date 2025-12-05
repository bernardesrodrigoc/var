import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilial } from '@/context/FilialContext';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, TrendingUp, Award, MinusCircle, Trash2, Edit2, Save, X } from 'lucide-react';
import api from '@/lib/api';

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState(null);
  
  // Date range - default to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const [dataInicio, setDataInicio] = useState(firstDay.toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(lastDay.toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [editingVale, setEditingVale] = useState(null);
  const [valesDeducao, setValesDeducao] = useState({});
  const { selectedFilial } = useFilial();
  const { toast } = useToast();

  useEffect(() => {
    if (selectedFilial) {
      loadPagamentos();
    }
  }, [dataInicio, dataFim, selectedFilial]);

  const loadPagamentos = async () => {
    if (!selectedFilial) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/reports/pagamentos-detalhados`, {
        params: {
          data_inicio: dataInicio,
          data_fim: dataFim,
          filial_id: selectedFilial.id
        }
      });
      setPagamentos(response.data);
      
      // Initialize vales deduction state (all selected by default)
      const initialVales = {};
      response.data.vendedores.forEach(v => {
        v.vales.forEach(vale => {
          initialVales[vale.id] = true;
        });
      });
      setValesDeducao(initialVales);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados de pagamento',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVale = (valeId) => {
    setValesDeducao(prev => ({
      ...prev,
      [valeId]: !prev[valeId]
    }));
  };

  const handleDeleteVale = async (valeId) => {
    if (!window.confirm('Tem certeza que deseja excluir este vale?')) {
      return;
    }

    try {
      await api.delete(`/vales/${valeId}`);
      toast({
        title: 'Vale excluído!',
        description: 'O vale foi removido com sucesso',
      });
      loadPagamentos();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o vale',
      });
    }
  };

  const handleEditVale = (vale) => {
    setEditingVale({
      ...vale,
      valor: vale.valor,
      observacoes: vale.observacoes || ''
    });
  };

  const handleSaveVale = async () => {
    if (!editingVale) return;

    try {
      await api.put(`/vales/${editingVale.id}`, {
        vendedora_id: editingVale.vendedora_id,
        vendedora_nome: editingVale.vendedora_nome,
        valor: parseFloat(editingVale.valor),
        mes: editingVale.mes,
        ano: editingVale.ano,
        observacoes: editingVale.observacoes
      });
      
      toast({
        title: 'Vale atualizado!',
        description: 'As alterações foram salvas com sucesso',
      });
      
      setEditingVale(null);
      loadPagamentos();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o vale',
      });
    }
  };

  const calculateTotalAPagar = (vendedor) => {
    const valesDeduzidos = vendedor.vales
      .filter(v => valesDeducao[v.id])
      .reduce((sum, v) => sum + v.valor, 0);
    
    return vendedor.comissao_base + vendedor.bonus_valor - valesDeduzidos;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!pagamentos) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Erro ao carregar dados</div>
      </div>
    );
  }

  const totalGeralPagamentos = pagamentos.vendedores.reduce(
    (sum, v) => sum + calculateTotalAPagar(v), 
    0
  );

  return (
    <div className="space-y-6" data-testid="pagamentos-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatório de Pagamentos</h1>
          <p className="text-gray-500 mt-1">Resumo detalhado de comissões e bônus</p>
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

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Geral - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total de Vendedores</p>
              <p className="text-2xl font-bold text-blue-600">{pagamentos.vendedores.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total em Vendas</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(pagamentos.vendedores.reduce((sum, v) => sum + v.total_vendas, 0))}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total em Comissões</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(pagamentos.vendedores.reduce((sum, v) => sum + v.comissao_base + v.bonus_valor, 0))}
              </p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-300">
              <p className="text-sm text-gray-600 mb-1">Total a Pagar</p>
              <p className="text-3xl font-bold text-indigo-600">
                {formatCurrency(totalGeralPagamentos)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Vendor Cards */}
      {pagamentos.vendedores.map((vendedor) => {
        const totalAPagar = calculateTotalAPagar(vendedor);
        
        return (
          <Card key={vendedor.vendedora_id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{vendedor.vendedor}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {vendedor.num_vendas} vendas • {vendedor.total_pecas} peças • Meta: {vendedor.percentual_meta.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total a Pagar</p>
                  <p className="text-3xl font-bold text-indigo-600">{formatCurrency(totalAPagar)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Sales, Commission, and Bonus */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-600">Vendas</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(vendedor.total_vendas)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <DollarSign className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-600">Comissão Base ({pagamentos.percentual_comissao}%)</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(vendedor.comissao_base)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <Award className="w-8 h-8 text-purple-500" />
                    <div>
                      <p className="text-xs text-gray-600">Bônus</p>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(vendedor.bonus_valor)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <MinusCircle className="w-8 h-8 text-red-500" />
                    <div>
                      <p className="text-xs text-gray-600">Vales a Deduzir</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(vendedor.vales.filter(v => valesDeducao[v.id]).reduce((sum, v) => sum + v.valor, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vales List */}
                {vendedor.vales.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Vales (Adiantamentos):</h4>
                    <div className="space-y-2">
                      {vendedor.vales.map((vale) => (
                        <div 
                          key={vale.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                            valesDeducao[vale.id] 
                              ? 'bg-red-50 border-red-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          {editingVale?.id === vale.id ? (
                            // Edit Mode
                            <div className="flex-1 flex items-center gap-3">
                              <Input
                                type="number"
                                value={editingVale.valor}
                                onChange={(e) => setEditingVale({...editingVale, valor: e.target.value})}
                                className="w-32"
                                step="0.01"
                              />
                              <Input
                                type="text"
                                value={editingVale.observacoes}
                                onChange={(e) => setEditingVale({...editingVale, observacoes: e.target.value})}
                                placeholder="Observações"
                                className="flex-1"
                              />
                              <Button size="sm" onClick={handleSaveVale} className="bg-green-600 hover:bg-green-700">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingVale(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <div className="flex items-center gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  checked={valesDeducao[vale.id] || false}
                                  onChange={() => handleToggleVale(vale.id)}
                                  className="w-5 h-5 rounded border-gray-300"
                                />
                                <div>
                                  <p className="font-semibold text-gray-900">{formatCurrency(vale.valor)}</p>
                                  {vale.observacoes && (
                                    <p className="text-xs text-gray-500">{vale.observacoes}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-500">
                                  {new Date(vale.data).toLocaleDateString('pt-BR')}
                                </p>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleEditVale(vale)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleDeleteVale(vale.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {vendedor.vales.length === 0 && (
                  <p className="text-sm text-gray-500 italic">Nenhum vale registrado neste período</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {pagamentos.vendedores.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">Nenhuma venda registrada neste período</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
