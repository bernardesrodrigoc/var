import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, DollarSign } from 'lucide-react';
import api from '@/lib/api';

export default function Vales() {
  const [vales, setVales] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    vendedora_id: '',
    vendedora_nome: '',
    valor: 0,
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    observacoes: '',
  });
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (user.role !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: 'Apenas administradores podem acessar esta página',
      });
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, valesData] = await Promise.all([
        api.get('/users'),
        api.get('/vales/vendedora/all').catch(() => ({ data: [] })),
      ]);
      
      setUsers(usersData.data.filter(u => u.role === 'vendedora'));
      
      // Load vales for all vendedoras
      const allVales = [];
      for (const user of usersData.data.filter(u => u.role === 'vendedora')) {
        try {
          const response = await api.get(`/vales/vendedora/${user.id}`);
          allVales.push(...response.data);
        } catch (error) {
          console.error(`Erro ao carregar vales de ${user.full_name}:`, error);
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

  const handleOpenDialog = () => {
    setFormData({
      vendedora_id: '',
      vendedora_nome: '',
      valor: 0,
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      observacoes: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/vales', formData);
      toast({ title: 'Vale registrado com sucesso!' });
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.response?.data?.detail || 'Erro ao registrar vale',
      });
    }
  };

  const handleSelectVendedora = (userId) => {
    const vendedora = users.find(u => u.id === userId);
    setFormData({
      ...formData,
      vendedora_id: userId,
      vendedora_nome: vendedora?.full_name || '',
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  // Group vales by vendedora and month
  const valesByVendedora = vales.reduce((acc, vale) => {
    const key = `${vale.vendedora_nome}-${vale.mes}-${vale.ano}`;
    if (!acc[key]) {
      acc[key] = {
        vendedora_nome: vale.vendedora_nome,
        mes: vale.mes,
        ano: vale.ano,
        total: 0,
        vales: [],
      };
    }
    acc[key].total += vale.valor;
    acc[key].vales.push(vale);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="vales-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vales (Adiantamentos)</h1>
          <p className="text-gray-500 mt-1">Gerencie vales das vendedoras</p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="add-vale-button">
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
              {formatCurrency(
                vales
                  .filter(v => v.mes === new Date().getMonth() + 1 && v.ano === new Date().getFullYear())
                  .reduce((sum, v) => sum + v.valor, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedora</TableHead>
                <TableHead>Mês/Ano</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vales.map((vale) => (
                <TableRow key={vale.id}>
                  <TableCell className="font-medium">{vale.vendedora_nome}</TableCell>
                  <TableCell>{vale.mes}/{vale.ano}</TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    {formatCurrency(vale.valor)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{vale.observacoes || '-'}</TableCell>
                  <TableCell className="text-sm">{formatDate(vale.data)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {vales.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum vale registrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Vale</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendedora">Vendedora *</Label>
              <Select value={formData.vendedora_id} onValueChange={handleSelectVendedora}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma vendedora" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
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
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano">Ano *</Label>
                <Input
                  id="ano"
                  type="number"
                  value={formData.ano}
                  onChange={(e) => setFormData({...formData, ano: parseInt(e.target.value)})}
                  required
                />
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
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
