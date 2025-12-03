import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ClipboardCheck, Play, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

export default function BalancoEstoque() {
  const [balancoAtivo, setBalancoAtivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('semanal');
  const [iniciando, setIniciando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBalancoAtivo();
  }, []);

  const loadBalancoAtivo = async () => {
    try {
      const response = await api.get('/balanco-estoque/ativo');
      setBalancoAtivo(response.data);
    } catch (error) {
      console.error('Erro ao carregar balanço:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarBalanco = async () => {
    setIniciando(true);
    try {
      const response = await api.post(`/balanco-estoque/iniciar?tipo=${tipo}`);
      setBalancoAtivo(response.data);
      toast({
        title: 'Balanço iniciado!',
        description: `${response.data.items.length} produtos selecionados para conferência`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível iniciar o balanço',
      });
    } finally {
      setIniciando(false);
    }
  };

  const handleConferirItem = async (productId, quantidade) => {
    try {
      await api.put(`/balanco-estoque/${balancoAtivo.id}/conferir/${productId}?quantidade_contada=${quantidade}`);
      
      // Atualizar item localmente
      const updatedItems = balancoAtivo.items.map(item => {
        if (item.product_id === productId) {
          return {
            ...item,
            quantidade_contada: quantidade,
            diferenca: quantidade - item.quantidade_sistema,
            conferido: true,
          };
        }
        return item;
      });
      
      setBalancoAtivo({ ...balancoAtivo, items: updatedItems });
      
      toast({
        title: 'Item conferido!',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível conferir o item',
      });
    }
  };

  const handleConcluir = async () => {
    if (!window.confirm('Deseja ajustar o estoque automaticamente com base nas contagens?')) return;
    
    setConcluindo(true);
    try {
      await api.post(`/balanco-estoque/${balancoAtivo.id}/concluir?ajustar_estoque=true`);
      
      toast({
        title: 'Balanço concluído!',
        description: 'Estoque ajustado automaticamente',
      });
      
      setBalancoAtivo(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível concluir o balanço',
      });
    } finally {
      setConcluindo(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  if (!balancoAtivo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Balanço de Estoque</h1>
          <p className="text-gray-500 mt-1">Sistema inteligente de conferência</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <ClipboardCheck className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Iniciar Novo Balanço</h2>
                <p className="text-gray-600">
                  Selecione o tipo de balanço e clique para começar
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Balanço</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">
                        <div>
                          <p className="font-medium">Semanal (Recomendado)</p>
                          <p className="text-xs text-gray-500">10-15 produtos aleatórios</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="mensal">
                        <div>
                          <p className="font-medium">Mensal</p>
                          <p className="text-xs text-gray-500">30-50 produtos</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="completo">
                        <div>
                          <p className="font-medium">Completo</p>
                          <p className="text-xs text-gray-500">Todos os produtos</p>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleIniciarBalanco} 
                  disabled={iniciando}
                  className="w-full h-12 text-lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {iniciando ? 'Iniciando...' : 'Iniciar Balanço'}
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Como funciona:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Sistema seleciona produtos aleatoriamente</li>
                  <li>• Produtos não repetem até ciclo completo</li>
                  <li>• Conte fisicamente e insira a quantidade</li>
                  <li>• Estoque ajustado automaticamente ao concluir</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalItens = balancoAtivo.items.length;
  const conferidos = balancoAtivo.items.filter(i => i.conferido).length;
  const comDiferenca = balancoAtivo.items.filter(i => i.conferido && i.diferenca !== 0).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Balanço em Andamento</h1>
          <p className="text-gray-500 mt-1">
            {conferidos}/{totalItens} itens conferidos
          </p>
        </div>
        <Button
          onClick={handleConcluir}
          disabled={conferidos < totalItens || concluindo}
        >
          <Save className="w-4 h-4 mr-2" />
          {concluindo ? 'Concluindo...' : 'Concluir Balanço'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Progresso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {((conferidos / totalItens) * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">{conferidos} de {totalItens}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Com Diferença</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{comDiferenca}</div>
            <p className="text-xs text-gray-500 mt-1">Requer ajuste</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 capitalize">{balancoAtivo.tipo}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produtos para Conferência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {balancoAtivo.items.map((item, index) => (
              <ItemBalanco
                key={item.product_id}
                item={item}
                index={index}
                onConferir={handleConferirItem}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemBalanco({ item, index, onConferir }) {
  const [quantidade, setQuantidade] = useState(item.quantidade_contada || '');
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (quantidade === '') return;
    setSalvando(true);
    await onConferir(item.product_id, parseInt(quantidade));
    setSalvando(false);
  };

  return (
    <div className={`p-4 border rounded-lg ${item.conferido ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600">
          {index + 1}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-medium text-gray-900">{item.descricao}</p>
              <p className="text-sm text-gray-500">Código: {item.codigo}</p>
            </div>
            {item.conferido && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Sistema:</p>
              <p className="font-bold text-gray-900">{item.quantidade_sistema}</p>
            </div>
            
            {item.conferido ? (
              <>
                <div>
                  <p className="text-gray-600">Contado:</p>
                  <p className="font-bold text-gray-900">{item.quantidade_contada}</p>
                </div>
                <div>
                  <p className="text-gray-600">Diferença:</p>
                  <p className={`font-bold ${
                    item.diferenca === 0 ? 'text-green-600' :
                    item.diferenca > 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {item.diferenca > 0 && '+'}{item.diferenca}
                  </p>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <p className="text-gray-600 mb-1">Quantidade Contada:</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="Digite a quantidade"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSalvar}
                    disabled={quantidade === '' || salvando}
                    size="sm"
                  >
                    {salvando ? 'Salvando...' : 'Conferir'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
