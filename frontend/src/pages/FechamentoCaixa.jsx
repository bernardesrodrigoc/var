import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFilial } from '@/context/FilialContext';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { DollarSign, CreditCard, Smartphone, Wallet, Save, History, MinusCircle, PlusCircle, ArrowUpRight, AlertTriangle, Lock, Unlock } from 'lucide-react';
import api from '@/lib/api';

export default function FechamentoCaixa() {
  const [statusCaixa, setStatusCaixa] = useState('nao_iniciado');
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  
  // Abertura
  const [valorInicial, setValorInicial] = useState('');
  
  // Movimentos (Sangria, Gerencia, Suprimento)
  const [movimentoOpen, setMovimentoOpen] = useState(false);
  const [tipoMovimento, setTipoMovimento] = useState(''); // 'sangria', 'retirada_gerencia', 'suprimento'
  const [movimentoData, setMovimentoData] = useState({ valor: '', observacao: '' });

  // Histórico
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [dataInicioHist, setDataInicioHist] = useState(new Date().toISOString().split('T')[0]);
  const [dataFimHist, setDataFimHist] = useState(new Date().toISOString().split('T')[0]);

  const { selectedFilial } = useFilial();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canManage = ['vendedora', 'gerente', 'admin'].includes(user.role);
  const canViewHistory = ['admin', 'gerente'].includes(user.role);

  useEffect(() => {
    if (selectedFilial) {
      loadResumo();
    }
  }, [selectedFilial]);

  const loadResumo = async () => {
    if (!selectedFilial) return;
    setLoading(true);
    try {
      // Passa a filial explicitamente para garantir que admin veja a loja certa
      const response = await api.get(`/fechamento-caixa/hoje?filial_id=${selectedFilial.id}`);
      setResumo(response.data);
      setStatusCaixa(response.data.status_caixa);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao carregar caixa' });
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirCaixa = async () => {
    const valor = parseFloat(valorInicial);
    if (isNaN(valor)) {
      toast({ variant: 'destructive', title: 'Valor inválido' });
      return;
    }

    try {
      await api.post('/caixa/abrir', {
        filial_id: selectedFilial.id,
        valor_inicial: valor,
        usuario: user.full_name
      });
      toast({ title: 'Caixa Aberto!', description: `Iniciado com ${formatCurrency(valor)}` });
      loadResumo();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao abrir caixa', description: error.response?.data?.detail });
    }
  };

  const openMovimentoDialog = (tipo) => {
    setTipoMovimento(tipo);
    setMovimentoData({ valor: '', observacao: '' });
    setMovimentoOpen(true);
  };

  const handleSalvarMovimento = async () => {
    const valor = parseFloat(movimentoData.valor);
    if (isNaN(valor) || valor <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido' });
      return;
    }
    if (!movimentoData.observacao) {
      toast({ variant: 'destructive', title: 'Informe uma descrição' });
      return;
    }

    try {
      await api.post('/caixa/movimento', {
        filial_id: selectedFilial.id,
        usuario: user.full_name,
        tipo: tipoMovimento,
        valor: valor,
        observacao: movimentoData.observacao
      });
      
      const titulos = {
        'sangria': 'Despesa Registrada',
        'retirada_gerencia': 'Retirada Registrada',
        'suprimento': 'Entrada Registrada'
      };
      
      toast({ title: titulos[tipoMovimento] });
      setMovimentoOpen(false);
      loadResumo();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao registrar movimento' });
    }
  };

  const handleFecharCaixa = async () => {
    if (!window.confirm('Confirma o fechamento do dia? Isso atualizará os valores finais no sistema.')) return;

    try {
      await api.post('/fechamento-caixa', {
        vendedora_id: user.id,
        vendedora_nome: user.full_name,
        filial_id: selectedFilial.id,
        saldo_inicial: resumo.saldo_inicial,
        total_suprimentos: resumo.total_suprimentos,
        total_sangrias: resumo.total_sangrias,
        total_retiradas_gerencia: resumo.total_retiradas_gerencia,
        
        total_dinheiro: resumo.total_dinheiro,
        total_pix: resumo.total_pix,
        total_cartao: resumo.total_cartao,
        total_credito: resumo.total_credito,
        total_geral: resumo.total_geral,
        num_vendas: resumo.num_vendas,
        observacoes: observacoes
      });

      toast({ title: 'Caixa Fechado com Sucesso!' });
      setObservacoes('');
      loadResumo();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao fechar caixa' });
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
      toast({ variant: 'destructive', title: 'Erro ao carregar histórico' });
    }
  };

  if (loading) return <div className="flex justify-center items-center h-96">Carregando...</div>;

  // --- ABERTURA ---
  if (statusCaixa === 'nao_iniciado') {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-full max-w-md shadow-lg border-2 border-indigo-100">
          <CardHeader className="text-center bg-indigo-50/50 pb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Unlock className="w-8 h-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl text-indigo-900">Abertura de Caixa</CardTitle>
            <CardDescription>Informe o valor em dinheiro na gaveta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Fundo de Troco (R$)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                className="text-lg h-12"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                autoFocus
              />
            </div>
            <Button onClick={handleAbrirCaixa} className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700">
              Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- GESTÃO ---
  
  // Cálculo do Dinheiro na Gaveta
  const dinheiroNaGaveta = (resumo.saldo_inicial || 0) 
                         + (resumo.total_dinheiro || 0) 
                         + (resumo.total_suprimentos || 0) 
                         - (resumo.total_sangrias || 0) 
                         - (resumo.total_retiradas_gerencia || 0);

  return (
    <div className="space-y-6 pb-10" data-testid="fechamento-page">
      {/* ALERTA DE INCONSISTÊNCIA */}
      {resumo.inconsistencia_abertura && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <p className="font-bold">Atenção: Inconsistência de Caixa!</p>
              <p className="text-sm">
                O valor de abertura de hoje não bate com o fechamento de ontem. 
                Diferença: <strong>{formatCurrency(resumo.diferenca_abertura)}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Gestão de Caixa
            {statusCaixa === 'fechado' && <span className="text-sm bg-gray-200 text-gray-800 px-3 py-1 rounded-full flex items-center gap-1"><Lock className="w-3 h-3"/> FECHADO</span>}
            {statusCaixa === 'aberto' && <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center gap-1"><Unlock className="w-3 h-3"/> ABERTO</span>}
          </h1>
          <p className="text-gray-500 mt-1">Filial: {selectedFilial.nome}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canViewHistory && (
            <Button variant="outline" onClick={handleOpenHistorico}>
              <History className="w-4 h-4 mr-2" /> Histórico
            </Button>
          )}
          
          {statusCaixa === 'aberto' && (
            <>
              <Button variant="outline" className="text-green-700 border-green-200 hover:bg-green-50" onClick={() => openMovimentoDialog('suprimento')}>
                <PlusCircle className="w-4 h-4 mr-2" /> Suprimento
              </Button>
              <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => openMovimentoDialog('sangria')}>
                <MinusCircle className="w-4 h-4 mr-2" /> Despesa
              </Button>
              <Button variant="outline" className="text-orange-700 border-orange-200 hover:bg-orange-50" onClick={() => openMovimentoDialog('retirada_gerencia')}>
                <ArrowUpRight className="w-4 h-4 mr-2" /> Gerência
              </Button>
            </>
          )}

          {canManage && (
            <Button onClick={handleFecharCaixa} className="bg-gray-900 hover:bg-gray-800">
              <Save className="w-4 h-4 mr-2" /> 
              {statusCaixa === 'aberto' ? 'Fechar Caixa' : 'Atualizar Fechamento'}
            </Button>
          )}
        </div>
      </div>

      {/* PAINEL DE CONFERÊNCIA DE DINHEIRO */}
      <Card className="border-2 border-green-100 bg-green-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-green-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Dinheiro em Espécie (Gaveta)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
            <div className="p-2 bg-white rounded shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Saldo Inicial</p>
              <p className="text-base font-mono text-gray-700">+{formatCurrency(resumo.saldo_inicial)}</p>
            </div>
            <div className="p-2 bg-white rounded shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Vendas Dinheiro</p>
              <p className="text-base font-mono text-green-600">+{formatCurrency(resumo.total_dinheiro)}</p>
            </div>
            <div className="p-2 bg-white rounded shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Suprimentos</p>
              <p className="text-base font-mono text-green-600">+{formatCurrency(resumo.total_suprimentos)}</p>
            </div>
            <div className="p-2 bg-white rounded shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Despesas</p>
              <p className="text-base font-mono text-red-600">-{formatCurrency(resumo.total_sangrias)}</p>
            </div>
            <div className="p-2 bg-white rounded shadow-sm">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Retirada Gerência</p>
              <p className="text-base font-mono text-orange-600">-{formatCurrency(resumo.total_retiradas_gerencia)}</p>
            </div>
            <div className="p-2 bg-green-100 rounded shadow-sm border border-green-200">
              <p className="text-[10px] text-green-800 uppercase font-bold">Total Gaveta</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(dinheiroNaGaveta)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Pix / Transf.</CardTitle>
            <Smartphone className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{formatCurrency(resumo.total_pix)}</div>
            <p className="text-xs text-blue-600 mt-1">Total Bancário</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Cartão</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{formatCurrency(resumo.total_cartao)}</div>
            <p className="text-xs text-purple-600 mt-1">Crédito e Débito</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Fiado (A Receber)</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{formatCurrency(resumo.total_credito)}</div>
            <p className="text-xs text-orange-600 mt-1">Vendas a prazo</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas por Vendedora */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Vendedora</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Qtd Vendas</TableHead>
                  <TableHead className="text-right">Total Vendido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.vendas_por_vendedora && resumo.vendas_por_vendedora.length > 0 ? (
                  resumo.vendas_por_vendedora.map((v, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{v.nome}</TableCell>
                      <TableCell className="text-right">{v.qtd}</TableCell>
                      <TableCell className="text-right font-bold text-indigo-600">{formatCurrency(v.total)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-4">Nenhuma venda hoje</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Movimentações do Dia */}
        <Card>
          <CardHeader>
            <CardTitle>Movimentações do Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.lista_movimentos && resumo.lista_movimentos.length > 0 ? (
                  resumo.lista_movimentos.map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          m.tipo === 'suprimento' ? 'bg-green-100 text-green-700' :
                          m.tipo === 'retirada_gerencia' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {m.tipo === 'suprimento' ? 'Entrada' : m.tipo === 'retirada_gerencia' ? 'Gerência' : 'Despesa'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{m.observacao}</TableCell>
                      <TableCell className={`text-right font-mono ${m.tipo === 'suprimento' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.tipo === 'suprimento' ? '+' : '-'}{formatCurrency(m.valor)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-4">Nenhuma movimentação</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Observações */}
      <Card>
        <CardContent className="pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações do Fechamento
          </label>
          <textarea
            className="w-full p-3 border rounded-md h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Digite aqui justificativas de diferenças, etc..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Dialog Movimento (Sangria/Suprimento) */}
      <Dialog open={movimentoOpen} onOpenChange={setMovimentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tipoMovimento === 'suprimento' ? 'Adicionar Dinheiro (Entrada)' : 
               tipoMovimento === 'retirada_gerencia' ? 'Retirada para Gerência' : 'Registrar Despesa (Sangria)'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={movimentoData.valor}
                onChange={e => setMovimentoData({...movimentoData, valor: e.target.value})}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição / Motivo</label>
              <Input 
                placeholder={tipoMovimento === 'suprimento' ? 'Ex: Troco inicial extra' : 'Ex: Recolhimento de valores'} 
                value={movimentoData.observacao}
                onChange={e => setMovimentoData({...movimentoData, observacao: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovimentoOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSalvarMovimento} 
              className={tipoMovimento === 'suprimento' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico */}
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
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right font-bold">Gaveta Final</TableHead>
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
                historicoData.map((f) => {
                  const gavetaFinal = (f.saldo_inicial || 0) + (f.total_dinheiro || 0) + (f.total_suprimentos || 0) - (f.total_sangrias || 0) - (f.total_retiradas_gerencia || 0);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(f.data).toLocaleDateString('pt-BR')} <br/>
                        <span className="text-xs text-gray-500">{new Date(f.data).toLocaleTimeString('pt-BR')}</span>
                      </TableCell>
                      <TableCell>{f.vendedora_nome}</TableCell>
                      <TableCell className="text-right">{formatCurrency(f.saldo_inicial)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(f.total_dinheiro)}</TableCell>
                      <TableCell className="text-right text-red-600">-{formatCurrency((f.total_sangrias || 0) + (f.total_retiradas_gerencia || 0))}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(gavetaFinal)}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate" title={f.observacoes}>
                        {f.inconsistencia_abertura && <span className="text-red-600 font-bold block">! Inconsistência</span>}
                        {f.observacoes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
