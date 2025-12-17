import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFilial } from '@/context/FilialContext';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { DollarSign, CreditCard, Smartphone, Wallet, Save, History, MinusCircle, Lock, Unlock } from 'lucide-react';
import api from '@/lib/api';

export default function FechamentoCaixa() {
  const [statusCaixa, setStatusCaixa] = useState('nao_iniciado'); // nao_iniciado, aberto, fechado
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  
  // Estados para Abertura
  const [valorInicial, setValorInicial] = useState('');
  
  // Estados para Sangria
  const [sangriaOpen, setSangriaOpen] = useState(false);
  const [sangriaData, setSangriaData] = useState({ valor: '', observacao: '' });

  // Estados para Histórico
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [dataInicioHist, setDataInicioHist] = useState(new Date().toISOString().split('T')[0]);
  const [dataFimHist, setDataFimHist] = useState(new Date().toISOString().split('T')[0]);

  const { selectedFilial } = useFilial();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canManage = user.role === 'vendedora' || user.role === 'gerente' || user.role === 'admin';
  const canViewHistory = user.role === 'admin' || user.role === 'gerente';

  useEffect(() => {
    if (selectedFilial) {
      loadResumo();
    }
  }, [selectedFilial]);

  const loadResumo = async () => {
    if (!selectedFilial) return;
    setLoading(true);
    try {
      const response = await api.get('/fechamento-caixa/hoje');
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

  const handleSalvarSangria = async () => {
    const valor = parseFloat(sangriaData.valor);
    if (isNaN(valor) || valor <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido' });
      return;
    }
    if (!sangriaData.observacao) {
      toast({ variant: 'destructive', title: 'Informe o motivo (ex: Padaria)' });
      return;
    }

    try {
      await api.post('/caixa/sangria', {
        filial_id: selectedFilial.id,
        usuario: user.full_name,
        tipo: 'sangria',
        valor: valor,
        observacao: sangriaData.observacao
      });
      toast({ title: 'Sangria Registrada!' });
      setSangriaOpen(false);
      setSangriaData({ valor: '', observacao: '' });
      loadResumo();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao registrar sangria' });
    }
  };

  const handleFecharCaixa = async () => {
    if (!window.confirm('Confirma o fechamento do dia? Isso atualizará os valores finais.')) return;

    try {
      await api.post('/fechamento-caixa', {
        vendedora_id: user.id,
        vendedora_nome: user.full_name,
        filial_id: selectedFilial.id,
        saldo_inicial: resumo.saldo_inicial,
        total_sangrias: resumo.total_sangrias,
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
      loadResumo(); // Atualiza para mostrar status fechado
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

  // --- TELA DE ABERTURA DE CAIXA ---
  if (statusCaixa === 'nao_iniciado') {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-full max-w-md shadow-lg border-2 border-indigo-100">
          <CardHeader className="text-center bg-indigo-50/50 pb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Unlock className="w-8 h-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl text-indigo-900">Abertura de Caixa</CardTitle>
            <CardDescription>Informe o valor em dinheiro na gaveta para iniciar o dia.</CardDescription>
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

  // --- TELA DE GESTÃO DO CAIXA (ABERTO OU FECHADO) ---
  
  // Cálculo do dinheiro FÍSICO esperado na gaveta
  const dinheiroEmCaixa = (resumo.saldo_inicial || 0) + (resumo.total_dinheiro || 0) - (resumo.total_sangrias || 0);

  return (
    <div className="space-y-6 pb-10" data-testid="fechamento-page">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Gestão de Caixa
            {statusCaixa === 'fechado' && <span className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full flex items-center gap-1"><Lock className="w-3 h-3"/> FECHADO</span>}
            {statusCaixa === 'aberto' && <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center gap-1"><Unlock className="w-3 h-3"/> ABERTO</span>}
          </h1>
          <p className="text-gray-500 mt-1">Controle diário e conferência de valores</p>
        </div>
        <div className="flex gap-2">
          {canViewHistory && (
            <Button variant="outline" onClick={handleOpenHistorico}>
              <History className="w-4 h-4 mr-2" /> Histórico
            </Button>
          )}
          {statusCaixa === 'aberto' && (
            <Button variant="destructive" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setSangriaOpen(true)}>
              <MinusCircle className="w-4 h-4 mr-2" /> Retirada / Sangria
            </Button>
          )}
          {canManage && statusCaixa === 'aberto' && (
            <Button onClick={handleFecharCaixa} className="bg-gray-900 hover:bg-gray-800">
              <Save className="w-4 h-4 mr-2" /> Fechar Caixa
            </Button>
          )}
          {canManage && statusCaixa === 'fechado' && (
            <Button onClick={handleFecharCaixa} variant="outline">
              <Save className="w-4 h-4 mr-2" /> Atualizar Fechamento
            </Button>
          )}
        </div>
      </div>

      {/* PAINEL DE CONFERÊNCIA DE DINHEIRO */}
      <Card className="border-2 border-green-100 bg-green-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-green-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Conferência do Dinheiro (Gaveta)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-white rounded shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold">Saldo Inicial</p>
              <p className="text-lg font-mono text-gray-700">+{formatCurrency(resumo.saldo_inicial)}</p>
            </div>
            <div className="p-3 bg-white rounded shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold">Vendas Dinheiro</p>
              <p className="text-lg font-mono text-green-600">+{formatCurrency(resumo.total_dinheiro)}</p>
            </div>
            <div className="p-3 bg-white rounded shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold">Sangrias (Saídas)</p>
              <p className="text-lg font-mono text-red-600">-{formatCurrency(resumo.total_sangrias)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded shadow-sm border border-green-200">
              <p className="text-xs text-green-800 uppercase font-bold">Total na Gaveta</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(dinheiroEmCaixa)}</p>
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
            <p className="text-xs text-blue-600 mt-1">Na conta bancária</p>
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
            <p className="text-xs text-orange-600 mt-1">Saldo devedor gerado</p>
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

        {/* Histórico de Sangrias */}
        <Card>
          <CardHeader>
            <CardTitle>Saídas e Despesas (Sangrias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.lista_sangrias && resumo.lista_sangrias.length > 0 ? (
                  resumo.lista_sangrias.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{s.observacao}</TableCell>
                      <TableCell className="text-right text-red-600">-{formatCurrency(s.valor)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-gray-500 py-4">Nenhuma retirada hoje</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Campo de Observações */}
      <Card>
        <CardContent className="pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações do Fechamento
          </label>
          <textarea
            className="w-full p-3 border rounded-md h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Digite aqui quebras de caixa, justificativas, etc..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Dialog Sangria */}
      <Dialog open={sangriaOpen} onOpenChange={setSangriaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Retirada (Sangria)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={sangriaData.valor}
                onChange={e => setSangriaData({...sangriaData, valor: e.target.value})}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo / Descrição</label>
              <Input 
                placeholder="Ex: Compra de material de limpeza" 
                value={sangriaData.observacao}
                onChange={e => setSangriaData({...sangriaData, observacao: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSangriaOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarSangria} className="bg-red-600 hover:bg-red-700">Confirmar Retirada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico (IGUAL AO ANTERIOR) */}
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
                <TableHead>Saldo Inicial</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Sangrias</TableHead>
                <TableHead className="text-right font-bold">Total Geral</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nenhum fechamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                historicoData.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(f.data).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>{formatCurrency(f.saldo_inicial)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(f.total_geral)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      -{formatCurrency(f.total_sangrias)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(f.total_geral + f.saldo_inicial - f.total_sangrias)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${f.status === 'fechado' ? 'bg-gray-200' : 'bg-green-100 text-green-800'}`}>
                        {f.status}
                      </span>
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
