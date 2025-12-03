import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Send, DollarSign, Filter, Edit, Trash2, X } from 'lucide-react';
import api from '@/lib/api';

export default function TransferenciasAvancado() {
  const [transferencias, setTransferencias] = useState([]);
  const [filteredTransferencias, setFilteredTransferencias] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransferencia, setEditingTransferencia] = useState(null);
  const [formData, setFormData] = useState({
    valor: 0,
    observacoes: '',
  });
  const [editFormData, setEditFormData] = useState({
    valor: 0,
    observacoes: '',
  });
  
  // Filtros
  const [filterVendedora, setFilterVendedora] = useState('all');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  
  const { toast } = useToast();
  const { selectedFilial } = useFilial();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'gerente';
  const isVendedora = user.role === 'vendedora';

  useEffect(() => {
    if (selectedFilial) {
      loadData();
    }
  }, [selectedFilial]);

  useEffect(() => {
    applyFilters();
  }, [transferencias, filterVendedora, filterDataInicio, filterDataFim]);

  const loadData = async () => {
    if (!selectedFilial) return;
    
    try {
      // Carregar vendedoras da filial atual
      const usersResponse = await api.get('/users');
      const vendedorasDaFilial = usersResponse.data.filter(
        u => u.role === 'vendedora' && u.filial_id === selectedFilial.id && u.active
      );
      setVendedoras(vendedorasDaFilial);
      
      // Carregar transferências da filial
      if (isAdmin) {
        const response = await api.get('/transferencias');
        // Filtrar apenas transferências da filial atual
        const transferenciasDaFilial = response.data.filter(
          t => t.filial_id === selectedFilial.id
        );
        setTransferencias(transferenciasDaFilial);
      } else if (isVendedora) {
        // Vendedora vê apenas suas próprias transferências
        const response = await api.get(`/transferencias/vendedora/${user.id}`);
        const transferenciasDaFilial = response.data.filter(
          t => t.filial_id === selectedFilial.id
        );
        setTransferencias(transferenciasDaFilial);
      }
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transferencias];

    // Filtro por vendedora
    if (filterVendedora !== 'all') {
      filtered = filtered.filter(t => t.vendedora_nome === filterVendedora);
    }

    // Filtro por data
    if (filterDataInicio) {
      filtered = filtered.filter(t => new Date(t.data) >= new Date(filterDataInicio));
    }
    if (filterDataFim) {
      filtered = filtered.filter(t => new Date(t.data) <= new Date(filterDataFim + 'T23:59:59'));
    }

    setFilteredTransferencias(filtered);
  };

  const clearFilters = () => {
    setFilterVendedora('all');
    setFilterDataInicio('');
    setFilterDataFim('');
  };

  const handleOpenDialog = () => {
    setFormData({ valor: 0, observacoes: '' });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (transf) => {
    setEditingTransferencia(transf);
    setEditFormData({
      valor: transf.valor,
      observacoes: transf.observacoes || '',
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.valor <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero',
      });
      return;
    }
    
    try {
      await api.post('/transferencias', {
        vendedora_id: user.id,
        vendedora_nome: user.full_name,
        filial_id: selectedFilial.id,
        valor: formData.valor,
        observacoes: formData.observacoes,
      });
      toast({ title: 'Transferência registrada com sucesso!' });
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível registrar a transferência',
      });
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/transferencias/${editingTransferencia.id}`, editFormData);
      
      toast({ title: 'Transferência atualizada!' });
      setEditDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao atualizar transferência',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta transferência?')) return;

    try {
      await api.delete(`/transferencias/${id}`);
      toast({ title: 'Transferência excluída!' });
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao excluir transferência',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  const totalGeral = filteredTransferencias.reduce((sum, t) => sum + t.valor, 0);
  const totalHoje = filteredTransferencias
    .filter(t => new Date(t.data).toDateString() === new Date().toDateString())
    .reduce((sum, t) => sum + t.valor, 0);

  return (
    <div className="space-y-6" data-testid="transferencias-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferências para Gerência</h1>
          <p className="text-gray-500 mt-1">
            {isAdmin ? 'Histórico completo com filtros' : 'Registre dinheiro enviado para gerência'}
          </p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="add-transferencia-button">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Transferência
        </Button>
      </div>

      {/* Summary Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Hoje</CardTitle>
              <Send className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalHoje)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Filtrado</CardTitle>
              <DollarSign className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalGeral)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{filteredTransferencias.length} transferências</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Vendedora</Label>
                <Select value={filterVendedora} onValueChange={setFilterVendedora}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {vendedoras.map((vendedora) => (
                      <SelectItem key={vendedora.id} value={vendedora.full_name}>
                        {vendedora.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filterDataInicio}
                  onChange={(e) => setFilterDataInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filterDataFim}
                  onChange={(e) => setFilterDataFim(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transferencias Table */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Transferências</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Vendedora</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransferencias.map((transf) => (
                  <TableRow key={transf.id}>
                    <TableCell className="text-sm">
                      {formatDate(transf.data)} {new Date(transf.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                    </TableCell>
                    <TableCell className="font-medium">{transf.vendedora_nome}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {formatCurrency(transf.valor)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{transf.observacoes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(transf)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(transf.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredTransferencias.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Nenhuma transferência encontrada com os filtros aplicados
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Send className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg text-gray-600 mb-2">Registre suas transferências</p>
              <p className="text-sm text-gray-500">
                Clique em "Registrar Transferência" para anotar o dinheiro enviado para gerência
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Criar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Transferência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({...formData, valor: parseFloat(e.target.value) || 0})}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Ex: Dinheiro do caixa do dia"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Send className="w-4 h-4 mr-2" />
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transferência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-valor">Valor (R$) *</Label>
              <Input
                id="edit-valor"
                type="number"
                step="0.01"
                min="0"
                value={editFormData.valor}
                onChange={(e) => setEditFormData({...editFormData, valor: parseFloat(e.target.value) || 0})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-observacoes">Observações</Label>
              <Input
                id="edit-observacoes"
                value={editFormData.observacoes}
                onChange={(e) => setEditFormData({...editFormData, observacoes: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Atualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
