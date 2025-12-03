import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { productsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Search, Barcode } from 'lucide-react';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    descricao: '',
    quantidade: 0,
    preco_custo: 0,
    preco_venda: 0,
    categoria: 'Geral',
  });
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = user.role === 'admin' || user.role === 'gerente';

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(
      (p) =>
        p.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const loadProducts = async () => {
    try {
      const data = await productsAPI.getAll();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os produtos',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        codigo: '',
        descricao: '',
        quantidade: 0,
        preco_custo: 0,
        preco_venda: 0,
        categoria: 'Geral',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, formData);
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        await productsAPI.create(formData);
        toast({ title: 'Produto criado com sucesso!' });
      }
      setDialogOpen(false);
      loadProducts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.response?.data?.detail || 'Erro ao salvar produto',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await productsAPI.delete(id);
      toast({ title: 'Produto excluído com sucesso!' });
      loadProducts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o produto',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  return (
    <div className="space-y-6" data-testid="products-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 mt-1">Gerencie seu catálogo de produtos</p>
        </div>
        {canEdit && (
          <Button onClick={() => handleOpenDialog()} data-testid="add-product-button">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Produto
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por descrição, código ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-products-input"
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                {canEdit && <TableHead className="text-right">Preço Custo</TableHead>}
                <TableHead className="text-right">Preço Venda</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} data-testid={`product-row-${product.codigo}`}>
                  <TableCell className="font-mono">
                    <div className="flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-gray-400" />
                      {product.codigo}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{product.descricao}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {product.categoria}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        product.quantidade < 5 ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
                      {product.quantidade}
                    </span>
                  </TableCell>
                  {canEdit && <TableCell className="text-right">{formatCurrency(product.preco_custo)}</TableCell>}
                  <TableCell className="text-right font-medium">
                    {formatCurrency(product.preco_venda)}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(product)}
                          data-testid={`edit-product-${product.codigo}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                          data-testid={`delete-product-${product.codigo}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Sem permissão</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum produto encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código / Código de Barras</Label>
              <Input
                id="codigo"
                data-testid="product-codigo-input"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                data-testid="product-descricao-input"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  data-testid="product-quantidade-input"
                  type="number"
                  min="0"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_custo">Preço Custo</Label>
                <Input
                  id="preco_custo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.preco_custo}
                  onChange={(e) => setFormData({ ...formData, preco_custo: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preco_venda">Preço Venda</Label>
              <Input
                id="preco_venda"
                data-testid="product-preco-input"
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_venda}
                onChange={(e) => setFormData({ ...formData, preco_venda: parseFloat(e.target.value) })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" data-testid="save-product-button">
                {editingProduct ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
