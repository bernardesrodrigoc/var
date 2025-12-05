import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, CreditCard, Smartphone, Gift, Save } from 'lucide-react';
import api from '@/lib/api';

export default function FechamentoCaixa() {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [vendasDetalhadas, setVendasDetalhadas] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { selectedFilial } = useFilial();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (selectedFilial) {
      loadResumo();
    }
  }, [selectedFilial]);

  const loadResumo = async () => {
    if (!selectedFilial) return;
    
    try {
      // Usar endpoint de fechamento que já inclui vendas + pagamentos
      const fechamentoResponse = await api.get('/fechamento-caixa/hoje');
      const fechamento = fechamentoResponse.data;
      
      setResumo({
        total_dinheiro: fechamento.total_dinheiro,
        total_pix: fechamento.total_pix,
        total_cartao: fechamento.total_cartao,
        total_credito: fechamento.total_credito,
        total_geral: fechamento.total_geral,
        num_vendas: fechamento.num_vendas,
        num_pagamentos: fechamento.num_pagamentos || 0,
        total_pagamentos: fechamento.total_pagamentos || 0,
        pagamentos: fechamento.pagamentos || []
      });
      
      // Carregar vendas detalhadas separadamente
      const hoje = new Date().toISOString().split('T')[0];
      const salesResponse = await api.get(`/sales?filial_id=${selectedFilial.id}`);
      const vendasHoje = salesResponse.data.filter(sale => {
        const saleDate = new Date(sale.data).toISOString().split('T')[0];
        return saleDate === hoje && !sale.estornada;
      });
      
      setVendasDetalhadas(vendasHoje);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o resumo do caixa',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarFechamento = async () => {
    if (!resumo || !selectedFilial) return;

    setSaving(true);
    try {
      await api.post('/fechamento-caixa', {
        vendedora_id: user.id || 'unknown',
        vendedora_nome: user.full_name,
        filial_id: selectedFilial.id,
        total_dinheiro: resumo.total_dinheiro,
        total_pix: resumo.total_pix,
        total_cartao: resumo.total_cartao,
        total_credito: resumo.total_credito,
        total_geral: resumo.total_geral,
        num_vendas: resumo.num_vendas,
        observacoes: observacoes,
      });

      toast({
        title: 'Fechamento salvo!',
        description: 'Fechamento de caixa registrado com sucesso',
      });
      setObservacoes('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar o fechamento',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="fechamento-caixa-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Fechamento de Caixa</h1>
        <p className="text-gray-500 mt-1">Confira as vendas do dia</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Dinheiro</CardTitle>
            <DollarSign className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumo?.total_dinheiro || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pix</CardTitle>
            <Smartphone className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(resumo?.total_pix || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cartão</CardTitle>
            <CreditCard className="w-5 h-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(resumo?.total_cartao || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Crédito Loja</CardTitle>
            <Gift className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(resumo?.total_credito || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total de Vendas</p>
                <p className="text-sm text-gray-500">{resumo?.num_vendas || 0} vendas realizadas</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-indigo-600">
                  {formatCurrency(resumo?.total_geral || 0)}
                </p>
              </div>
            </div>

            {resumo?.total_misto > 0 && (
              <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Pagamentos Mistos</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(resumo.total_misto)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (Opcional)</Label>
              <Input
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Faltaram R$ 10 no caixa"
              />
            </div>

            <Button
              onClick={handleSalvarFechamento}
              disabled={saving}
              className="w-full h-12 text-lg"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Fechamento'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'Dinheiro', value: resumo?.total_dinheiro || 0, icon: DollarSign, color: 'text-green-600' },
              { label: 'Pix', value: resumo?.total_pix || 0, icon: Smartphone, color: 'text-blue-600' },
              { label: 'Cartão', value: resumo?.total_cartao || 0, icon: CreditCard, color: 'text-purple-600' },
              { label: 'Crédito Loja', value: resumo?.total_credito || 0, icon: Gift, color: 'text-orange-600' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className={`text-lg font-bold ${item.color}`}>
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recebimentos de Clientes */}
      {resumo && resumo.pagamentos && resumo.pagamentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>💰 Recebimentos de Clientes ({resumo.num_pagamentos})</span>
              <span className="text-lg text-green-600 font-bold">
                Total: {formatCurrency(resumo.total_pagamentos)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resumo.pagamentos.map((pagamento, idx) => (
                <div key={idx} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {new Date(pagamento.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - {pagamento.vendedora_nome}
                      </p>
                      <p className="text-sm text-gray-600">Cliente: {pagamento.customer_nome}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Forma: {pagamento.forma_pagamento}
                      </p>
                      {pagamento.observacoes && (
                        <p className="text-xs text-gray-500 italic mt-1">{pagamento.observacoes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(pagamento.valor)}
                      </p>
                      <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded-full">
                        Recebimento
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Vendas Detalhadas */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas do Dia ({vendasDetalhadas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {vendasDetalhadas.length > 0 ? (
            <div className="space-y-3">
              {vendasDetalhadas.map((venda) => (
                <div key={venda.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {venda.hora} - {venda.vendedor}
                      </p>
                      {venda.cliente_nome && (
                        <p className="text-sm text-gray-500">Cliente: {venda.cliente_nome}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-indigo-600">
                        {formatCurrency(venda.total)}
                      </p>
                      <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                        {venda.modalidade_pagamento}
                      </span>
                    </div>
                  </div>
                  
                  {/* Produtos */}
                  <div className="mt-2 space-y-1">
                    {venda.items.map((item, idx) => (
                      <div key={idx} className="text-sm text-gray-600 flex justify-between">
                        <span>
                          {item.quantidade}x {item.descricao}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagamentos mistos */}
                  {venda.modalidade_pagamento === 'Misto' && venda.pagamentos && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-gray-500 mb-1">Formas de pagamento:</p>
                      {venda.pagamentos.map((pag, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex justify-between">
                          <span>{pag.modalidade}</span>
                          <span>{formatCurrency(pag.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhuma venda realizada hoje</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
