import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { useFilial } from '@/context/FilialContext';
import { useToast } from '@/components/ui/use-toast';
import { ArrowUpRight, Calendar, User, Search, Trash2, Edit, Filter, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';

export default function Transferencias() {
  const [transferencias, setTransferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  const [filtros, setFiltros] = useState({
    data_inicio: firstDay,
    data_fim: today,
    responsavel: ''
  });

  // Edição
  const [editingItem, setEditingItem] = useState(null);
  const [editData, setEditData] = useState({ valor: '', observacao: '' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { selectedFilial } = useFilial();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (selectedFilial) {
      loadTransferencias();
    }
  }, [selectedFilial, filtros.data_inicio, filtros.data_fim]); // Recarrega ao mudar data

  const loadTransferencias = async () => {
    try {
      setLoading(true);
      // Monta query string
      let url = `/transferencias?filial_id=${selectedFilial.id}`;
      if (filtros.data_inicio) url += `&data_inicio=${filtros.data_inicio}`;
      if (filtros.data_fim) url += `&data_fim=${filtros.data_fim}`;
      if (filtros.responsavel) url += `&responsavel=${filtros.responsavel}`;

      const response = await api.get(url);
      setTransferencias(response.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadTransferencias();
  };

  // --- DELETE ÚNICO ---
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      await api.delete(`/caixa/movimento/${id}`);
      toast({ title: 'Excluído com sucesso' });
      loadTransferencias();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir' });
    }
  };

  // --- DELETE EM MASSA (BULK) ---
  const handleBulkDelete = async () => {
    if (transferencias.length === 0) return;
    
    const confirmMsg = `ATENÇÃO: Você está prestes a excluir ${transferencias.length} registros listados no filtro atual.\n\nIntervalo: ${filtros.data_inicio} até ${filtros.data_fim}\n\nEssa ação NÃO pode ser desfeita. Tem certeza absoluta?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const ids = transferencias.map(t => t.id);
      await api.post('/caixa/movimentos/bulk-delete', { ids });
      
      toast({ title: 'Registros excluídos com sucesso' });
      loadTransferencias();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro na exclusão em massa', description: error.response?.data?.detail });
    }
  };

  // --- EDIÇÃO ---
  const handleEdit = (item) => {
    setEditingItem(item);
    setEditData({ valor: item.valor, observacao: item.observacao });
    setEditDialogOpen(true);
  };

  const saveEdit = async () => {
    try {
      await api.put(`/caixa/movimento/${editingItem.id}`, {
        ...editingItem, // Mantém dados originais
        valor: parseFloat(editData.valor),
        observacao: editData.observacao
      });
      toast({ title: 'Atualizado com sucesso' });
      setEditDialogOpen(false);
      loadTransferencias();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar' });
    }
  };

  const totalTransferido = transferencias.reduce((acc, curr) => acc + curr.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferências para Gerência</h1>
          <p className="text-gray-500 mt-1">Conferência e gestão de retiradas</p>
        </div>
        
        {/* Bulk Delete Button (Só Admin) */}
        {isAdmin && transferencias.length > 0 && (
          <Button variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir {transferencias.length} registros listados
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleFilterSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">De:</label>
              <Input type="date" value={filtros.data_inicio} onChange={e => setFiltros({...filtros, data_inicio: e.target.value})} />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Até:</label>
              <Input type="date" value={filtros.data_fim} onChange={e => setFiltros({...filtros, data_fim: e.target.value})} />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Responsável:</label>
              <Input 
                placeholder="Nome da vendedora..." 
                value={filtros.responsavel} 
                onChange={e => setFiltros({...filtros, responsavel: e.target.value})} 
              />
            </div>
            <Button type="submit" variant="secondary">
              <Filter className="w-4 h-4 mr-2" /> Filtrar
            </Button>
            {(filtros.responsavel || filtros.data_inicio !== firstDay) && (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  setFiltros({ data_inicio: firstDay, data_fim: today, responsavel: '' });
                  loadTransferencias();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Resumo e Tabela */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registros Encontrados</CardTitle>
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5" />
            Total: {formatCurrency(totalTransferido)}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : transferencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    Nenhum registro encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                transferencias.map((transf) => (
                  <TableRow key={transf.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(transf.data).toLocaleDateString('pt-BR')} 
                        <span className="text-xs text-gray-400 ml-1">
                          {new Date(transf.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {transf.usuario}
                      </div>
                    </TableCell>
                    <TableCell>{transf.observacao || '-'}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">
                      {formatCurrency(transf.valor)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(transf)}>
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(transf.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transferência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={editData.valor}
                onChange={e => setEditData({...editData, valor: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Input 
                value={editData.observacao}
                onChange={e => setEditData({...editData, observacao: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
