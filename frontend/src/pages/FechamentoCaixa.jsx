import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFilial } from '@/context/FilialContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { DollarSign, CreditCard, Smartphone, Wallet, Save, Calendar, History, Eye } from 'lucide-react';
import api from '@/lib/api';

export default function FechamentoCaixa() {
  const [resumo, setResumo] = useState(null);
  const [vendasDetalhadas, setVendasDetalhadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  
  // Estados para Histórico
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [dataInicioHist, setDataInicioHist] = useState(new Date().toISOString().split('T')[0]);
  const [dataFimHist, setDataFimHist] = useState(new Date().toISOString().split('T')[0]);

  const { selectedFilial } = useFilial();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canSave = user.role === 'vendedora' || user.role === 'gerente';
  const canViewHistory = user.role === 'admin' || user.role === 'gerente';

  // --- LÓGICA DE CÁLCULO LOCAL PARA OS CARDS ---
  // Isso resolve o problema da venda mista não aparecer nos cards
  const totaisCalculados = vendasDetalhadas.reduce((acc, venda) => {
    // Se for mista, percorre os pagamentos internos
    if (venda.modalidade_pagamento === 'Misto' && venda.pagamentos) {
      venda.pagamentos.forEach(pag => {
        const tipo = pag.modalidade; // Dinheiro, Pix, Cartao, Credito
        if (acc[tipo] !== undefined) {
          acc[tipo] += pag.valor;
        }
      });
    } else {
      // Venda normal (única forma)
      const tipo = venda.modalidade_pagamento;
      // Mapeia tipos do banco para as chaves do acumulador
      if (tipo === 'Dinheiro') acc.Dinheiro += venda.total;
      else if (tipo === 'Pix') acc.Pix += venda.total;
      else if (tipo === 'Cartao') acc.Cartao += venda.total;
      else if (tipo === 'Credito') acc.Credito += venda.total;
    }
    return acc;
  }, { Dinheiro: 0, Pix: 0, Cartao: 0, Credito: 0 });

  // Adiciona os pagamentos de saldo devedor (recebimentos de dívida) aos totais
  if (resumo?.pagamentos) {
    resumo.pagamentos.forEach(pag => {
      const tipo = pag.forma_pagamento;
      if (tipo === 'Dinheiro') totaisCalculados.Dinheiro += pag.valor;
      else if (tipo === 'Pix' || tipo === 'Transferencia') totaisCalculados.Pix += pag.valor;
      else if (tipo === 'Cartao') totaisCalculados.Cartao += pag.valor;
    });
  }
  // ----------------------------------------------

  useEffect(() => {
    if (selectedFilial) {
      loadResumo();
    }
  }, [selectedFilial]);

  const loadResumo = async () => {
    if (!selectedFilial) return;
    setLoading(true);
    try {
      // 1. Busca resumo básico do backend
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
      
      // 2. Busca TODAS as vendas do dia para detalhamento e cálculo correto dos cards
      const hoje = new Date().toISOString().split('T')[0];
      const fimDoDia = `${hoje}T23:59:59`;
      
      const salesResponse = await api.get(
        `/sales?filial_id=${selectedFilial.id}&data_inicio=${hoje}&data_fim=${fimDoDia}&limit=5000`
      );
      
      const vendasHoje = salesResponse.data.filter(sale => {
        return !sale.estornada && !sale.is_troca;
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
    if (!window.confirm('Confirma o fechamento do caixa? Certifique-se que os valores físicos batem com o sistema.')) return;

    try {
      await api.post('/fechamento-caixa', {
        vendedora_id: user.id,
        vendedora_nome: user.full_name,
        filial_id: selectedFilial.id,
        total_dinheiro: totaisCalculados.Dinheiro,
        total_pix: totaisCalculados.Pix,
        total_cartao: totaisCalculados.Cartao,
        total_credito: totaisCalculados.Credito,
        total_geral: totaisCalculados.Dinheiro + totaisCalculados.Pix + totaisCalculados.Cartao + totaisCalculados.Credito,
        num_vendas: vendasDetalhadas.length,
        observacoes: observacoes
      });

      toast({
        title: 'Caixa Fechado!',
        description: 'Os dados foram salvos com sucesso.',
      });
      setObservacoes('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao salvar fechamento',
      });
    }
  };

  const handleOpenHistorico = async () => {
    setHistoricoOpen(true);
    await loadHistorico();
  };

  const loadHistorico = async () => {
    try {
      const response = await api.get(`/fechamento-caixa/historico?data_inicio=${dataInicioHist}&data_fim=${dataFimHist}&filial_id=${selectedFilial.id}`);
      setHistoricoData(response.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o histórico',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando caixa...</div>;
  }

  // Total Geral Calculado (Soma das modalidades calculadas)
  const totalGeralCalculado = totaisCalculados.Dinheiro + totaisCalculados.Pix + totaisCalculados.Cartao + totaisCalculados.Credito;

  return (
    <div className="space-y-6" data-testid="fechamento-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fechamento de Caixa</h1>
          <p className="text-gray-500 mt-1">Conferência e encerramento do dia</p>
        </div>
        <div className="flex gap-2">
          {canViewHistory && (
            <Button variant="outline" onClick={handleOpenHistorico}>
              <History className="w-4 h-4 mr-2" />
              Histórico
            </Button>
          )}
          {canSave && (
            <Button onClick={handleSalvarFechamento} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Salvar Fechamento
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Resumo (AGORA USANDO OS VALORES CALCULADOS CORRETAMENTE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Dinheiro em Caixa</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(totaisCalculados.Dinheiro)}</div>
            <p className="text-xs text-green-600 mt-1">Vendas + Pagamentos</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Pix / Transf.</CardTitle>
            <Smartphone className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{formatCurrency(totaisCalculados.Pix)}</div>
            <p className="text-xs text-blue-600 mt-1">Conta Bancária</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Cartão</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{formatCurrency(totaisCalculados.Cartao)}</div>
            <p className="text-xs text-purple-600 mt-1">Crédito e Débito</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Fiado (A Receber)</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{formatCurrency(totaisCalculados.Credito)}</div>
            <p className="text-xs text-orange-600 mt-1">Saldo Devedor</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <div className="bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg">
          <span className="text-sm font-medium opacity-80 mr-2">Faturamento Total do Dia:</span>
          <span className="text-2xl font-bold">{formatCurrency(totalGeralCalculado)}</span>
        </div>
      </div>

      {/* Vendas do Dia */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Vendas ({vendasDetalhadas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendasDetalhadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Nenhuma venda registrada hoje.
                    </TableCell>
                  </TableRow>
                ) : (
                  vendasDetalhadas.map((venda) => (
                    <TableRow key={venda.id}>
                      <TableCell className="font-medium">{venda.hora}</TableCell>
                      <TableCell>{venda.vendedor}</TableCell>
                      <TableCell>{venda.cliente_nome || '-'}</TableCell>
                      <TableCell>{venda.items.length}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                          {venda.modalidade_pagamento}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-700">
                        {formatCurrency(venda.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Campo de Observações para Fechamento */}
      {canSave && (
        <Card>
          <CardContent className="pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações do Fechamento (Quebra de caixa, sangria, justificativas)
            </label>
            <textarea
              className="w-full p-3 border rounded-md h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Digite aqui..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* DIALOG DE HISTÓRICO */}
      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Fechamentos</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-4 items-end mb-4 bg-gray-50 p-3 rounded-lg">
            <div className="space-y-1">
              <label className="text-xs font-medium">De:</label>
              <input 
                type="date" 
                value={dataInicioHist} 
                onChange={e => setDataInicioHist(e.target.value)}
                className="block w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Até:</label>
              <input 
                type="date" 
                value={dataFimHist} 
                onChange={e => setDataFimHist(e.target.value)}
                className="block w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <Button size="sm" onClick={loadHistorico}>Filtrar</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Dinheiro</TableHead>
                <TableHead className="text-right">Pix</TableHead>
                <TableHead className="text-right">Cartão</TableHead>
                <TableHead className="text-right">Total Geral</TableHead>
                <TableHead>Obs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Nenhum fechamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                historicoData.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(f.data).toLocaleDateString('pt-BR')} <br/>
                      <span className="text-xs text-gray-500">{new Date(f.data).toLocaleTimeString('pt-BR')}</span>
                    </TableCell>
                    <TableCell>{f.vendedora_nome}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(f.total_dinheiro)}</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(f.total_pix)}</TableCell>
                    <TableCell className="text-right text-purple-600">{formatCurrency(f.total_cartao)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(f.total_geral)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={f.observacoes}>
                      {f.observacoes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
