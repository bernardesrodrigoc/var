import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Send, DollarSign } from 'lucide-react';
import api from '@/lib/api';

export default function Transferencias() {
  const [transferencias, setTransferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    valor: 0,
    observacoes: '',
  });
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    loadTransferencias();
  }, []);

  const loadTransferencias = async () => {
    try {
      if (isAdmin) {
        const response = await api.get('/transferencias');
        setTransferencias(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      valor: 0,
      observacoes: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transferencias', {
        vendedora_id: user.id || 'unknown',
        vendedora_nome: user.full_name,
        valor: formData.valor,
        observacoes: formData.observacoes,
      });
      
      toast({ 
        title: 'Transferência registrada!',
        description: `${formatCurrency(formData.valor)} enviado para gerência`,
      });
      
      setDialogOpen(false);
      loadTransferencias();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao registrar transferência',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  const totalHoje = transferencias
    .filter(t => new Date(t.data).toDateString() === new Date().toDateString())
    .reduce((sum, t) => sum + t.valor, 0);

  const totalMes = transferencias
    .filter(t => {
      const d = new Date(t.data);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.valor, 0);

  return (
    <div className="space-y-6" data-testid="transferencias-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferências para Gerência</h1>
          <p className="text-gray-500 mt-1">
            {isAdmin ? 'Histórico de transferências' : 'Registre dinheiro enviado para gerência'}
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
              <CardTitle className="text-sm font-medium text-gray-600">Transferido Hoje</CardTitle>
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
              <CardTitle className="text-sm font-medium text-gray-600">Transferido Mês Atual</CardTitle>
              <DollarSign className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalMes)}
              </div>
            </CardContent>
          </Card>
        </div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferencias.map((transf) => (
                  <TableRow key={transf.id}>
                    <TableCell className="text-sm">
                      {formatDate(transf.data)} {new Date(transf.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                    </TableCell>
                    <TableCell className="font-medium">{transf.vendedora_nome}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {formatCurrency(transf.valor)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{transf.observacoes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {transferencias.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Nenhuma transferência registrada
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

      {/* Dialog */}
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
    </div>
  );
}
