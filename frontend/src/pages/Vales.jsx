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
import { Plus, DollarSign, Edit, Trash2, Filter, Calendar } from 'lucide-react';
import api from '@/lib/api';

export default function Vales() {
  const [vales, setVales] = useState([]);
  const [filteredVales, setFilteredVales] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVale, setEditingVale] = useState(null);
  
  // Filtros
  const [filterVendedora, setFilterVendedora] = useState('all');
  const [filterMes, setFilterMes] = useState('all');
  const [filterAno, setFilterAno] = useState(new Date().getFullYear().toString());
  
  const [formData, setFormData] = useState({
    vendedora_id: '',
    vendedora_nome: '',
    valor: 0,
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    observacoes: '',
  });
  
  const { toast } = useToast();
  const { selectedFilial } = useFilial();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    // ✅ CORREÇÃO: Verifica se é admin OU gerente
    const canAccess = user.role === 'admin' || user.role === 'gerente';

    if (!canAccess) {
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: 'Apenas administradores e gerentes podem acessar esta página',
      });
      return;
    }
    
    if (selectedFilial) {
      loadData();
    }
  }, [selectedFilial]);

  useEffect(() => {
    applyFilters();
  }, [vales, filterVendedora, filterMes, filterAno]);

  const loadData = async () => {
    if (!selectedFilial) return;
    
    try {
      // Carregar vendedoras da filial atual
      const usersResponse = await api.get('/users');
      const vendedorasDaFilial = usersResponse.data.filter(
        u => u.role === 'vendedora' && u.filial_id === selectedFilial.id && u.active
      );
      setVendedoras(vendedorasDaFilial);
      
      // Carregar todos os vales
      const allVales = [];
      for (const vendedora of vendedorasDaFilial) {
        try {
          const response = await api.get(`/vales/vendedora/${vendedora.id}`);
          allVales.push(...response.data);
        } catch (error) {
          console.error(`Erro ao carregar vales de ${vendedora.full_name}:`, error);
        }
      }
      setVales(allVales);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vales];
    
    // Filtro por vendedora
    if (filterVendedora !== 'all') {
      filtered = filtered.filter(v => v.vendedora_id === filterVendedora);
    }
    
    // Filtro por mês
    if (filterMes !== 'all') {
      filtered = filtered.filter(v => v.mes === parseInt(filterMes));
    }
    
    // Filtro por ano
    if (filterAno !== 'all') {
      filtered = filtered.filter(v => v.ano === parseInt(filterAno));
    }
    
    // Ordenar por data mais recente
    filtered.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    setFilteredVales(filtered);
  };

  const handleOpenDialog = (vale = null) => {
    if (vale) {
      setEditingVale(vale);
      setFormData({
        vendedora_id: vale.vendedora_id,
        vendedora_nome: vale.vendedora_nome,
        valor: vale.valor,
        mes: vale.mes,
        ano: vale.ano,
        observacoes: vale.observacoes || '',
      });
    } else {
      setEditingVale(null);
      setFormData({
        vendedora_id: '',
        vendedora_nome: '',
        valor: 0,
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        observacoes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.vendedora_id || formData.valor <= 0) {
      toast({
        variant: 'destructive',
        title: 'Dados inválidos',
        description: 'Selecione uma vendedora e informe um valor válido',
      });
      return;
    }
    
    try {
      if (editingVale) {
        // Atualizar vale existente
        await api.put(`/vales/${editingVale.id}`, formData);
        toast({ title: 'Vale atualizado com sucesso!' });
      } else {
        // Criar novo vale
        await api.post('/vales', formData);
        toast({ title: 'Vale registrado com sucesso!' });
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.response?.data?.detail || 'Erro ao salvar vale',
      });
    }
  };

  const handleDelete = async (valeId) => {
    if (!window.confirm('Tem certeza que deseja excluir este vale?')) return;
    
    try {
      await api.delete(`/vales/${valeId}`);
      toast({ title: 'Vale excluído com sucesso!' });
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o vale',
      });
    }
  };

  const handleSelectVendedora = (userId) => {
    const vendedora = vendedoras.find(u => u.id === userId);
    setFormData({
      ...formData,
      vendedora_id: userId,
      vendedora_nome: vendedora?.full_name || '',
    });
  };

  const clearFilters = () => {
    setFilterVendedora('all');
    setFilterMes('all');
    setFilterAno(new Date().getFullYear().toString());
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  // Calcular totais
  const totalMesAtual = vales
    .filter(v => v.mes === new Date().getMonth() + 1 && v.ano === new Date().getFullYear())
    .reduce((sum, v) => sum + v.valor, 0);
  
  const totalFiltrado = filteredVales.reduce((sum, v) => sum + v.valor, 0);

  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
  ];

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6" data-testid="vales-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vales (Adiantamentos)</h1>
          <p className="text-gray-500 mt-1">Gerencie vales das vendedoras - {selectedFilial?.nome}</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="add-vale-button">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Vale
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Mês Atual</CardTitle>
            <DollarSign className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalMesAtual)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Filtrado</CardTitle>
            <Filter className="w-5 h-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(totalFiltrado)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Registros</CardTitle>
            <Calendar className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredVales.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
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
                  {vendedoras.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={filterAno} onValueChange={setFilterAno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={ano.toString()}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vales ({filteredVales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedora</TableHead>
                <TableHead>Mês/Ano</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Data Registro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVales.map((vale) => (
                <TableRow key={vale.id}>
                  <TableCell className="font-medium">{vale.vendedora_nome}</TableCell>
                  <TableCell>
                    {meses.find(m => m.value === vale.mes)?.label || vale.mes}/{vale.ano}
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    {formatCurrency(vale.valor)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                    {vale.observacoes || '-'}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(vale.data)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(vale)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(vale.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredVales.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum vale encontrado com os filtros aplicados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVale ? 'Editar Vale' : 'Registrar Vale'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendedora">Vendedora *</Label>
              <Select 
                value={formData.vendedora_id} 
                onValueChange={handleSelectVendedora}
                disabled={!!editingVale}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma vendedora" />
                </SelectTrigger>
                <SelectContent>
                  {vendedoras.map((vendedora) => (
                    <SelectItem key={vendedora.id} value={vendedora.id}>
                      {vendedora.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mes">Mês *</Label>
                <Select value={formData.mes.toString()} onValueChange={(v) => setFormData({...formData, mes: parseInt(v)})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano">Ano *</Label>
                <Select value={formData.ano.toString()} onValueChange={(v) => setFormData({...formData, ano: parseInt(v)})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map(ano => (
                      <SelectItem key={ano} value={ano.toString()}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
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
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Ex: Vale mensal, adiantamento emergencial..."
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingVale ? 'Atualizar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
