import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { productsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { Plus, Edit, Trash2, Search, Barcode, Upload, Download, CheckCircle, AlertCircle, Tag } from 'lucide-react'; // Adicionei Tag aqui
import api from '@/lib/api';
import * as XLSX from 'xlsx';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
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
  const { selectedFilial } = useFilial();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = user.role === 'admin' || user.role === 'gerente';
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (selectedFilial) {
      loadProducts();
    }
  }, [selectedFilial]);

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
    if (!selectedFilial) return;
    
    try {
      const response = await api.get(`/products?filial_id=${selectedFilial.id}&limit=10000`);
      setProducts(response.data);
      setFilteredProducts(response.data);
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
      // DICA EXTRA: Se quiser já preencher automaticamente o próximo código, use a linha comentada abaixo:
      // const nextCode = lastCode + 1;
      setFormData({
        codigo: '', // ou codigo: nextCode.toString(),
        descricao: '',
        quantidade: 0,
        preco_custo: 0,
        preco_venda: 0,
        categoria: 'Geral',
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
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, dataToSubmit);
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        await productsAPI.create(dataToSubmit);
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

  const downloadTemplate = () => {
    const template = [
      {
        codigo: 'PROD001',
        descricao: 'Exemplo de Produto',
        quantidade: 10,
        preco_custo: 50.00,
        preco_venda: 100.00,
        categoria: 'Eletrônicos'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 } 
    ];
    
    XLSX.writeFile(wb, `template_produtos_${selectedFilial.nome}.xlsx`);
    toast({ title: 'Template baixado com sucesso!' });
  };

  const exportProducts = async () => {
    try {
      const response = await api.get(`/products?filial_id=${selectedFilial.id}&limit=10000`);
      const allProducts = response.data;
      
      if (allProducts.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum produto',
          description: 'Não há produtos para exportar',
        });
        return;
      }

      const exportData = allProducts.map(p => ({
        codigo: p.codigo,
        descricao: p.descricao,
        quantidade: p.quantidade,
        preco_custo: p.preco_custo,
        preco_venda: p.preco_venda,
        categoria: p.categoria || 'Geral'
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      
      ws['!cols'] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 } 
      ];
      
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `produtos_${selectedFilial.nome}_${today}.xlsx`);
      
      toast({ 
        title: 'Produtos exportados!',
        description: `${allProducts.length} produtos exportados com sucesso` 
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: 'Não foi possível exportar os produtos',
      });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Arquivo vazio',
          description: 'O arquivo não contém dados',
        });
        setImporting(false);
        return;
      }

      const results = {
        success: 0,
        errors: 0,
        updated: 0,
        created: 0,
        details: []
      };

      for (const row of jsonData) {
        try {
          if (!row.codigo || !row.descricao) {
            results.errors++;
            results.details.push({
              codigo: row.codigo || 'SEM_CODIGO',
              status: 'erro',
              message: 'Código e descrição são obrigatórios'
            });
            continue;
          }

          const productData = {
            codigo: String(row.codigo).trim(),
            descricao: String(row.descricao).trim(),
            quantidade: parseInt(row.quantidade) || 0,
            preco_custo: parseFloat(row.preco_custo) || 0,
            preco_venda: parseFloat(row.preco_venda) || 0,
            categoria: row.categoria ? String(row.categoria).trim() : 'Geral',
            filial_id: selectedFilial.id
          };

          let existingProduct = null;
          try {
            const response = await api.get(`/products/barcode/${productData.codigo}?filial_id=${selectedFilial.id}`);
            existingProduct = response.data;
          } catch (error) {
            existingProduct = null;
          }

          if (existingProduct) {
            await api.put(`/products/${existingProduct.id}`, productData);
            results.updated++;
            results.details.push({
              codigo: productData.codigo,
              status: 'atualizado',
              message: 'Produto atualizado com sucesso'
            });
          } else {
            await api.post('/products', productData);
            results.created++;
            results.details.push({
              codigo: productData.codigo,
              status: 'criado',
              message: 'Produto criado com sucesso'
            });
          }

          results.success++;
        } catch (error) {
          results.errors++;
          results.details.push({
            codigo: row.codigo || 'DESCONHECIDO',
            status: 'erro',
            message: error.response?.data?.detail || 'Erro ao processar produto'
          });
        }
      }

      setImportResult(results);
      loadProducts();
      
      toast({
        title: 'Importação concluída!',
        description: `${results.success} produtos processados com sucesso, ${results.errors} erros`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar arquivo',
        description: 'Verifique se o arquivo está no formato correto',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  // --- NOVA FUNCIONALIDADE: CALCULAR ÚLTIMO CÓDIGO ---
  const lastCode = products.reduce((max, p) => {
    // Tenta converter o código para número
    const num = parseInt(p.codigo, 10);
    // Se for número válido e maior que o máximo atual, atualiza
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  // ---------------------------------------------------

  return (
    <div className="space-y-6" data-testid="products-page">
      {/* RESPONSIVO: Header muda de row para col em telas pequenas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Produtos</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm md:text-base text-gray-500">Gerencie seu catálogo - {selectedFilial?.nome}</p>
            
            {/* --- EXIBIÇÃO DO ÚLTIMO CÓDIGO --- */}
            {lastCode > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                <Tag className="w-3 h-3" />
                Último Cód: <strong>{lastCode}</strong>
              </span>
            )}
            {/* ---------------------------------- */}
          </div>
        </div>
        {canEdit && (
          // Botões empilhados no mobile, linha no desktop
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button onClick={downloadTemplate} variant="outline" className="w-full sm:w-auto text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button onClick={exportProducts} variant="outline" disabled={products.length === 0} className="w-full sm:w-auto text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="w-full sm:w-auto text-xs sm:text-sm">
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto text-xs sm:text-sm" data-testid="add-product-button">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {/* Restante do código igual... */}
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

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                   <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full mb-1 inline-block">
                    {product.categoria}
                  </span>
                  <h3 className="font-bold text-gray-900">{product.descricao}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <Barcode className="w-3 h-3" />
                    <span className="font-mono">{product.codigo}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4 text-sm border-t pt-2">
                <div>
                  <p className="text-gray-500 text-xs">Preço Venda</p>
                  <p className="font-bold text-green-700">{formatCurrency(product.preco_venda)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Estoque</p>
                  <p className={`font-medium ${product.quantidade < 5 ? 'text-red-600' : 'text-gray-900'}`}>
                    {product.quantidade} un
                  </p>
                </div>
                {canEdit && (
                  <div>
                    <p className="text-gray-500 text-xs">Preço Custo</p>
                    <p className="text-gray-700">{formatCurrency(product.preco_custo)}</p>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(product)} className="h-8">
                    <Edit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)} className="h-8 text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
         {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum produto encontrado
            </div>
          )}
      </div>

      <Card className="hidden md:block">
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
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
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
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
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
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_venda}
                onChange={(e) => setFormData({ ...formData, preco_venda: parseFloat(e.target.value) })}
                required
              />
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editingProduct ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Produtos do Excel</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">📋 Instruções:</h3>
              <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-blue-800">
                <li>Baixe o template clicando no botão "Baixar Template"</li>
                <li>Preencha a planilha com os dados dos produtos</li>
                <li>Campos obrigatórios: <strong>codigo</strong> e <strong>descricao</strong></li>
                <li>Se o código já existir, o produto será atualizado</li>
                <li>Faça upload do arquivo preenchido abaixo</li>
              </ol>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-8 h-8 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm sm:text-lg font-medium text-gray-700 mb-2">
                  {importing ? 'Processando...' : 'Clique para selecionar arquivo'}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  Formatos aceitos: .xlsx, .xls
                </p>
              </label>
            </div>

            {importing && (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span>Processando produtos...</span>
              </div>
            )}

            {importResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-green-600">{importResult.success}</p>
                          <p className="text-xs text-gray-600">Sucesso</p>
                        </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-blue-600">{importResult.created}</p>
                          <p className="text-xs text-gray-600">Criados</p>
                        </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 flex items-center gap-2">
                        <Edit className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-orange-600">{importResult.updated}</p>
                          <p className="text-xs text-gray-600">Atualizados</p>
                        </div>
                    </CardContent>
                  </Card>
                </div>

                {importResult.errors > 0 && (
                  <Card className="border-red-200">
                    <CardHeader>
                      <CardTitle className="text-red-600 flex items-center gap-2 text-sm sm:text-lg">
                        <AlertCircle className="w-5 h-5" />
                        {importResult.errors} erro(s) encontrado(s)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {importResult.details
                          .filter(d => d.status === 'erro')
                          .map((detail, idx) => (
                            <div key={idx} className="text-xs sm:text-sm bg-red-50 p-2 rounded">
                              <strong>{detail.codigo}:</strong> {detail.message}
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setImportDialogOpen(false);
                setImportResult(null);
              }}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
