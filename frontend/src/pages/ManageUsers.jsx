import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authAPI, usersAPI, reportsAPI, goalsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, User, Target, TrendingUp, Award } from 'lucide-react';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [performanceData, setPerformanceData] = useState({});
  const [filiais, setFiliais] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'vendedora',
    password: '',
    meta_mensal: 0,
    active: true,
    filial_id: '',
  });
  const { toast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: 'Apenas administradores podem acessar esta página',
      });
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const [usersData, filiaisData] = await Promise.all([
        usersAPI.getAll(),
        api.get('/filiais'),
      ]);
      setUsers(usersData);
      setFiliais(filiaisData.data);
      
      // Load performance for each vendedora
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      
      const perfData = {};
      for (const user of data.filter(u => u.role === 'vendedora')) {
        try {
          const sales = await reportsAPI.getSalesByVendor(month, year);
          const userSales = sales.find(s => s._id === user.full_name);
          if (userSales) {
            const percentual = user.meta_mensal > 0 
              ? (userSales.total_vendas / user.meta_mensal * 100) 
              : 0;
            perfData[user.id] = {
              vendas: userSales.total_vendas,
              num_vendas: userSales.num_vendas,
              percentual: percentual,
            };
          }
        } catch (error) {
          console.error(`Erro ao carregar performance de ${user.full_name}:`, error);
        }
      }
      setPerformanceData(perfData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os usuários',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        password: '',
        meta_mensal: user.meta_mensal || 0,
        active: user.active,
        filial_id: user.filial_id || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        full_name: '',
        role: 'vendedora',
        password: '',
        meta_mensal: 0,
        active: true,
        filial_id: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersAPI.update(editingUser.id, formData);
        toast({ title: 'Usuário atualizado com sucesso!' });
      } else {
        await authAPI.register(formData);
        toast({ title: 'Usuário criado com sucesso!' });
      }
      setDialogOpen(false);
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.response?.data?.detail || 'Erro ao salvar usuário',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      await usersAPI.delete(id);
      toast({ title: 'Usuário excluído com sucesso!' });
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o usuário',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  const vendedoras = users.filter(u => u.role === 'vendedora');
  const sortedVendedoras = [...vendedoras].sort((a, b) => {
    const perfA = performanceData[a.id]?.vendas || 0;
    const perfB = performanceData[b.id]?.vendas || 0;
    return perfB - perfA;
  });

  return (
    <div className="space-y-6" data-testid="manage-users-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Vendedoras</h1>
          <p className="text-gray-500 mt-1">Gerencie usuários e metas mensais</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="add-user-button">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Vendedora
        </Button>
      </div>

      {/* Ranking de Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Ranking do Mês - Top Vendedoras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedVendedoras.slice(0, 5).map((vendedora, index) => {
              const perf = performanceData[vendedora.id] || { vendas: 0, num_vendas: 0, percentual: 0 };
              const medalColors = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-600'];
              
              return (
                <div key={vendedora.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`flex-shrink-0 w-10 h-10 ${medalColors[index] || 'bg-blue-500'} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900">{vendedora.full_name}</span>
                      <span className="text-sm font-bold text-indigo-600">
                        {formatCurrency(perf.vendas)}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{perf.num_vendas} vendas</span>
                      <span>•</span>
                      <span>Meta: {formatCurrency(vendedora.meta_mensal)}</span>
                      <span>•</span>
                      <span className={perf.percentual >= 100 ? 'text-green-600 font-bold' : ''}>
                        {perf.percentual.toFixed(1)}% atingido
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                          style={{ width: `${Math.min(perf.percentual, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Meta Mensal</TableHead>
                <TableHead className="text-right">Vendas Mês</TableHead>
                <TableHead className="text-right">% Meta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const perf = performanceData[user.id] || { vendas: 0, percentual: 0 };
                
                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.username}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="font-medium">{user.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.username}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin' ? 'bg-red-100 text-red-700' : 
                        user.role === 'gerente' ? 'bg-blue-100 text-blue-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.role === 'vendedora' ? formatCurrency(user.meta_mensal || 0) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.role === 'vendedora' ? formatCurrency(perf.vendas) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.role === 'vendedora' ? (
                        <span className={`font-medium ${
                          perf.percentual >= 100 ? 'text-green-600' : 
                          perf.percentual >= 75 ? 'text-blue-600' : 
                          perf.percentual >= 50 ? 'text-orange-600' : 
                          'text-gray-600'
                        }`}>
                          {perf.percentual.toFixed(1)}%
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(user)}
                          data-testid={`edit-user-${user.username}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {user.username !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id)}
                            data-testid={`delete-user-${user.username}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha {editingUser && '(deixe em branco para manter)'}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função *</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="vendedora">Vendedora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filial">Filial *</Label>
              <Select value={formData.filial_id} onValueChange={(v) => setFormData({ ...formData, filial_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma filial" />
                </SelectTrigger>
                <SelectContent>
                  {filiais.map((filial) => (
                    <SelectItem key={filial.id} value={filial.id}>
                      {filial.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.role === 'vendedora' && (
              <div className="space-y-2">
                <Label htmlFor="meta_mensal">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Meta Mensal (R$) *
                  </div>
                </Label>
                <Input
                  id="meta_mensal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.meta_mensal}
                  onChange={(e) => setFormData({ ...formData, meta_mensal: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="active">Usuário Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingUser ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
