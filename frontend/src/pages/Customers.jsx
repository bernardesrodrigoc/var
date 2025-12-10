import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { customersAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { Plus, Edit, Trash2, Search, User, History, DollarSign, ShoppingBag } from 'lucide-react'; // <--- Adicionado ShoppingBag
import api from '@/lib/api';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Dialogs States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [creditHistoryDialogOpen, setCreditHistoryDialogOpen] = useState(false); // <--- Novo Dialog
  
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [creditPurchases, setCreditPurchases] = useState([]); // <--- Novo Estado para Compras Fiado
  
  const [selectedCustomerPagamento, setSelectedCustomerPagamento] = useState(null);
  const [pagamentoData, setPagamentoData] = useState({
    valor: '',
    forma_pagamento: 'Dinheiro',
    observacoes: ''
  });
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cpf: '',
    endereco: '',
    limite_credito: 0,
    saldo_devedor: 0,
  });
  
  const { toast } = useToast();
  const { selectedFilial } = useFilial();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canDelete = user.role === 'admin' || user.role === 'gerente';
  const canEditBalance = user.role === 'admin' || user.role === 'gerente';

  useEffect(() => {
    if (selectedFilial) {
      loadCustomers();
    }
  }, [selectedFilial]);

  useEffect(() => {
    const filtered = customers.filter(
      (c) =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.telefone && c.telefone.includes(searchTerm)) ||
        (c.cpf && c.cpf.includes(searchTerm))
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    if (!selectedFilial) return;
    
    try {
      const response = await api.get(`/customers?filial_id=${selectedFilial.id}`);
      setCustomers(response.data);
      setFilteredCustomers(response.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os clientes',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({
        nome: '',
        telefone: '',
        cpf: '',
        endereco: '',
        limite_credito: 0,
        saldo_devedor: 0,
        filial_id: selectedFilial?.id || '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const dataToSubmit = {
      ...formData,
      filial_id: selectedFilial?.id || formData.filial_id
    };
    
    try {
      if (editingCustomer) {
        await customersAPI.update(editingCustomer.id, dataToSubmit);
        toast({ title: 'Cliente atualizado com sucesso!' });
      } else {
        await customersAPI.create(dataToSubmit);
        toast({ title: 'Cliente criado com sucesso!' });
      }
      setDialogOpen(false);
      loadCustomers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.response?.data?.detail || 'Erro ao salvar cliente',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      await customersAPI.delete(id);
      toast({ title: 'Cliente excluído com sucesso!' });
      loadCustomers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o cliente',
      });
    }
  };

  const handleOpenPagamento = (customer) => {
    setSelectedCustomerPagamento(customer);
    setPagamentoData({
      valor: '',
      forma_pagamento: 'Dinheiro',
      observacoes: ''
    });
    setPagamentoDialogOpen(true);
  };

  const handlePagarSaldo = async () => {
    if (!selectedCustomerPagamento) return;
    
    const valor = parseFloat(pagamentoData.valor);
    if (isNaN(valor) || valor <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Informe um valor válido',
      });
      return;
    }

    if (valor > selectedCustomerPagamento.saldo_devedor) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Valor maior que o saldo devedor',
      });
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await api.post(`/customers/${selectedCustomerPagamento.id}/pagar-saldo`, {
        customer_id: selectedCustomerPagamento.id,
        customer_nome: selectedCustomerPagamento.nome,
        valor: valor,
        forma_pagamento: pagamentoData.forma_pagamento,
        vendedora_id: user.id,
        vendedora_nome: user.full_name,
        observacoes: pagamentoData.observacoes
      });

      toast({
        title: 'Pagamento registrado!',
        description: `${formatCurrency(valor)} recebido com sucesso`,
      });
      
      setPagamentoDialogOpen(false);
      loadCustomers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.response?.data?.detail || 'Não foi possível registrar o pagamento',
      });
    }
  };

  const handleViewPagamentos = async (customer) => {
    try {
      const response = await api.get(`/customers/${customer.id}/historico-pagamentos`);
      setCustomerHistory(response.data);
      setEditingCustomer(customer);
      setHistoryDialogOpen(true);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o histórico',
      });
    }
  };

  // --- NOVA FUNÇÃO: Ver o que comprou no Fiado ---
  const handleViewCreditPurchases = async (customer) => {
    try {
      const response = await api.get(`/customers/${customer.id}/compras-fiado`);
      setCreditPurchases(response.data);
      setEditingCustomer(customer);
      setCreditHistoryDialogOpen(true);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as compras a prazo',
      });
    }
  };
  // -----------------------------------------------

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  return (
    <div className="space-y-6" data-testid="customers-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1">Gerencie seus clientes e créditos</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="add-customer-button">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Cliente
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-customers-input"
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead className="text-right">Crédito Loja</TableHead>
                <TableHead className="text-right">Saldo Devedor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} data-testid={`customer-row-${customer.nome}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="font-medium">{customer.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>{customer.telefone || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{customer.cpf || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-medium ${customer.credito_loja > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatCurrency(customer.credito_loja || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        customer.saldo_devedor > 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {formatCurrency(customer.saldo_devedor || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Botão de Receber Pagamento */}
                      {customer.saldo_devedor > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenPagamento(customer)}
                          title="Receber pagamento"
                          className="text-green-600 hover:text-green-700"
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                      )}

                      {/* --- NOVO BOTÃO: Ver Itens do Fiado --- */}
                      {customer.saldo_devedor > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewCreditPurchases(customer)}
                          title="Ver o que comprou no fiado"
                          className="text-purple-600 hover:text-purple-700"
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </Button>
                      )}
                      {/* -------------------------------------- */}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewPagamentos(customer)}
                        title="Histórico de pagamentos"
                      >
                        <History className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(customer)}
                        data-testid={`edit-customer-${customer.nome}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(customer.id)}
                          data-testid={`delete-customer-${customer.nome}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum cliente encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog - Pagamentos */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico de Pagamentos - {editingCustomer?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {customerHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum pagamento registrado
              </div>
            ) : (
              customerHistory.map((pagamento) => (
                <div key={pagamento.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(pagamento.data).toLocaleDateString('pt-BR')} às {new Date(pagamento.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                      </p>
                      <p className="text-sm text-gray-500">Recebido por: {pagamento.vendedora_nome}</p>
                      <p className="text-sm text-gray-500">Forma: {pagamento.forma_pagamento}</p>
                      {pagamento.observacoes && (
                        <p className="text-sm text-gray-600 mt-1 italic">{pagamento.observacoes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">{formatCurrency(pagamento.valor)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- NOVO DIALOG: Histórico de Compras no Fiado --- */}
      <Dialog open={creditHistoryDialogOpen} onOpenChange={setCreditHistoryDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Compras no Fiado (Itens) - {editingCustomer?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {creditPurchases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma compra a prazo encontrada.
              </div>
            ) : (
              creditPurchases.map((venda) => (
                <div key={venda.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b">
                    <div>
                      <p className="font-bold text-gray-900">
                        Data: {new Date(venda.data).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-gray-500">Vendedora: {venda.vendedor}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(venda.total)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Lista de Itens daquela venda */}
                  <div className="bg-white rounded border p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Itens da Compra</p>
                    <ul className="space-y-2">
                      {venda.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            {item.quantidade}x {item.descricao}
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* -------------------------------------------------- */}

      {/* Pagamento Dialog */}
      <Dialog open={pagamentoDialogOpen} onOpenChange={setPagamentoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receber Pagamento</DialogTitle>
          </DialogHeader>
          {selectedCustomerPagamento && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Cliente:</p>
                <p className="font-semibold text-lg">{selectedCustomerPagamento.nome}</p>
                <p className="text-sm text-red-600 mt-2">
                  Saldo Devedor: <span className="font-bold">{formatCurrency(selectedCustomerPagamento.saldo_devedor)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_pagamento">Valor Recebido *</Label>
                <Input
                  id="valor_pagamento"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomerPagamento.saldo_devedor}
                  value={pagamentoData.valor}
                  onChange={(e) => setPagamentoData({ ...pagamentoData, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
                <select
                  id="forma_pagamento"
                  value={pagamentoData.forma_pagamento}
                  onChange={(e) => setPagamentoData({ ...pagamentoData, forma_pagamento: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartao">Cartão</option>
                  <option value="Transferencia">Transferência</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes_pagamento">Observações</Label>
                <Input
                  id="observacoes_pagamento"
                  value={pagamentoData.observacoes}
                  onChange={(e) => setPagamentoData({ ...pagamentoData, observacoes: e.target.value })}
                  placeholder="Observações adicionais (opcional)"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPagamentoDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handlePagarSaldo}>
                  Confirmar Pagamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                data-testid="customer-nome-input"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limite_credito">Limite Crédito</Label>
                <Input
                  id="limite_credito"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.limite_credito}
                  onChange={(e) => setFormData({ ...formData, limite_credito: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saldo_devedor">Saldo Devedor</Label>
                <Input
                  id="saldo_devedor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.saldo_devedor}
                  onChange={(e) => setFormData({ ...formData, saldo_devedor: parseFloat(e.target.value) || 0 })}
                  disabled={!canEditBalance}
                />
                {/* Opcional: Mostrar aviso visual se estiver bloqueado */}
                {!canEditBalance && (
                  <p className="text-[10px] text-gray-500">Apenas gerentes podem alterar o saldo manualmente.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" data-testid="save-customer-button">
                {editingCustomer ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
