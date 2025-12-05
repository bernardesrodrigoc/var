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
      // Carregar vendas do dia da filial atual
      const hoje = new Date().toISOString().split('T')[0];
      const response = await api.get(`/sales?filial_id=${selectedFilial.id}`);
      const salesData = response.data;
      
      // Filtrar vendas de hoje (excluindo estornadas)
      const vendasHoje = salesData.filter(sale => {
        const saleDate = new Date(sale.data).toISOString().split('T')[0];
        return saleDate === hoje && !sale.estornada;
      });
      
      // Calcular totais por forma de pagamento
      const totais = {
        total_dinheiro: 0,
        total_pix: 0,
        total_cartao: 0,
        total_credito: 0,
        total_geral: 0,
        num_vendas: vendasHoje.length
      };
      
      vendasHoje.forEach(sale => {
        totais.total_geral += sale.total;
        
        if (sale.modalidade_pagamento === 'Misto') {
          sale.pagamentos.forEach(pag => {
            if (pag.modalidade === 'Dinheiro') totais.total_dinheiro += pag.valor;
            else if (pag.modalidade === 'Pix') totais.total_pix += pag.valor;
            else if (pag.modalidade === 'Cartao') totais.total_cartao += pag.valor;
            else if (pag.modalidade === 'Credito') totais.total_credito += pag.valor;
          });
        } else {
          if (sale.modalidade_pagamento === 'Dinheiro') totais.total_dinheiro += sale.total;
          else if (sale.modalidade_pagamento === 'Pix') totais.total_pix += sale.total;
          else if (sale.modalidade_pagamento === 'Cartao') totais.total_cartao += sale.total;
          else if (sale.modalidade_pagamento === 'Credito') totais.total_credito += sale.total;
        }
      });
      
      setResumo(totais);
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
    </div>
  );
}
