import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { Settings, Plus, Trash2, Save, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function ComissaoConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    percentual_comissao: 1.0,
    bonus_tiers: [
      { percentual_meta: 80, valor_bonus: 100 },
      { percentual_meta: 90, valor_bonus: 150 },
      { percentual_meta: 100, valor_bonus: 200 },
      { percentual_meta: 110, valor_bonus: 300 },
    ]
  });
  
  const { toast } = useToast();
  const { selectedFilial } = useFilial();
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
    if (selectedFilial) {
      loadConfig();
    }
  }, [selectedFilial]);

  const loadConfig = async () => {
    if (!selectedFilial) return;
    
    try {
      const response = await api.get(`/comissao-config/${selectedFilial.id}`);
      setConfig(response.data);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validações
    if (config.percentual_comissao < 0 || config.percentual_comissao > 100) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Percentual de comissão deve estar entre 0 e 100',
      });
      return;
    }

    // Validar tiers
    for (const tier of config.bonus_tiers) {
      if (tier.percentual_meta <= 0 || tier.valor_bonus < 0) {
        toast({
          variant: 'destructive',
          title: 'Valores inválidos',
          description: 'Verifique os valores de % da meta e bônus',
        });
        return;
      }
    }

    setSaving(true);
    try {
      await api.put(`/comissao-config/${selectedFilial.id}`, config);
      toast({
        title: 'Configuração salva!',
        description: 'As novas regras de comissão foram aplicadas',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar a configuração',
      });
    } finally {
      setSaving(false);
    }
  };

  const addTier = () => {
    setConfig({
      ...config,
      bonus_tiers: [
        ...config.bonus_tiers,
        { percentual_meta: 120, valor_bonus: 400 }
      ]
    });
  };

  const removeTier = (index) => {
    if (config.bonus_tiers.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'Ação bloqueada',
        description: 'Deve haver pelo menos uma faixa de bonificação',
      });
      return;
    }
    
    const newTiers = config.bonus_tiers.filter((_, i) => i !== index);
    setConfig({ ...config, bonus_tiers: newTiers });
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...config.bonus_tiers];
    newTiers[index][field] = parseFloat(value) || 0;
    setConfig({ ...config, bonus_tiers: newTiers });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  // Ordenar tiers por percentual para exibição
  const sortedTiers = [...config.bonus_tiers].sort((a, b) => a.percentual_meta - b.percentual_meta);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuração de Comissões</h1>
          <p className="text-gray-500 mt-1">
            Configure as regras de comissão e bonificação - {selectedFilial?.nome}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </div>

      {/* Comissão Base */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Comissão Base
          </CardTitle>
          <CardDescription>
            Percentual aplicado sobre o valor total das vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="comissao">Percentual de Comissão (%)</Label>
            <div className="flex items-center gap-4 mt-2">
              <Input
                id="comissao"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={config.percentual_comissao}
                onChange={(e) => setConfig({ 
                  ...config, 
                  percentual_comissao: parseFloat(e.target.value) || 0 
                })}
                className="w-32"
              />
              <span className="text-lg font-semibold text-gray-700">%</span>
              <div className="flex-1 bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Exemplo:</strong> Vendas de R$ 10.000,00 = 
                  Comissão de {formatCurrency((10000 * config.percentual_comissao) / 100)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bonificações */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Faixas de Bonificação
              </CardTitle>
              <CardDescription>
                Configure os bônus baseados no atingimento de metas
              </CardDescription>
            </div>
            <Button onClick={addTier} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Faixa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedTiers.map((tier, index) => {
              const originalIndex = config.bonus_tiers.findIndex(
                t => t.percentual_meta === tier.percentual_meta && t.valor_bonus === tier.valor_bonus
              );
              
              return (
                <div 
                  key={index} 
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-600">% da Meta</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={tier.percentual_meta}
                          onChange={(e) => updateTier(originalIndex, 'percentual_meta', e.target.value)}
                          className="w-24"
                        />
                        <span className="text-sm font-medium">%</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Valor do Bônus</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm">R$</span>
                        <Input
                          type="number"
                          step="10"
                          min="0"
                          value={tier.valor_bonus}
                          onChange={(e) => updateTier(originalIndex, 'valor_bonus', e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 bg-white p-3 rounded border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Exemplo (Meta: R$ 10.000)</p>
                    <p className="text-sm font-medium text-purple-700">
                      Vender R$ {formatCurrency((10000 * tier.percentual_meta) / 100)} 
                      {' '}→ Ganhar {formatCurrency(tier.valor_bonus)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTier(originalIndex)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>💡 Dica:</strong> As vendedoras podem atingir múltiplas faixas. 
              Por exemplo, quem bater 110% da meta ganhará todos os bônus das faixas anteriores também.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-2 border-indigo-200 bg-indigo-50">
        <CardHeader>
          <CardTitle className="text-indigo-900">Resumo da Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Comissão Base:</span>
              <span className="font-bold text-green-600">{config.percentual_comissao}% das vendas</span>
            </div>
            <div className="border-t border-indigo-200 pt-3">
              <p className="font-semibold text-gray-700 mb-2">Bonificações:</p>
              <ul className="space-y-2">
                {sortedTiers.map((tier, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      Atingir {tier.percentual_meta}% da meta
                    </span>
                    <span className="font-semibold text-purple-600">
                      + {formatCurrency(tier.valor_bonus)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
