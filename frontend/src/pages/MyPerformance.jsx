import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { reportsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useFilial } from '@/context/FilialContext';
import { Target, TrendingUp, Award, DollarSign } from 'lucide-react';
import api from '@/lib/api';

export default function MyPerformance() {
  const [performance, setPerformance] = useState(null);
  const [comissaoConfig, setComissaoConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const { selectedFilial } = useFilial();

  useEffect(() => {
    if (selectedFilial) {
      loadData();
    }
  }, [selectedFilial]);

  const loadData = async () => {
    try {
      const [perfData, configData] = await Promise.all([
        reportsAPI.getMyPerformance(),
        api.get(`/comissao-config/${selectedFilial.id}`).then(r => r.data)
      ]);
      setPerformance(perfData);
      setComissaoConfig(configData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!performance || !comissaoConfig) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Erro ao carregar dados</div>
      </div>
    );
  }

  // Calcular comissão base
  const totalVendas = performance.vendas_realizadas || performance.total_vendas || 0;
  const comissaoBase = (totalVendas * comissaoConfig.percentual_comissao) / 100;

  // Calcular bônus baseado na configuração (maior faixa atingida)
  const meta = performance.meta_vendas || performance.goal || 0;
  const percentualAtingido = meta > 0 ? (totalVendas / meta) * 100 : 0;
  
  let bonusAtingido = 0;
  const sortedTiers = [...comissaoConfig.bonus_tiers].sort((a, b) => b.percentual_meta - a.percentual_meta);
  
  for (const tier of sortedTiers) {
    if (percentualAtingido >= tier.percentual_meta) {
      bonusAtingido = tier.valor_bonus;
      break;
    }
  }

  const totalGanhos = comissaoBase + bonusAtingido;

  return (
    <div className="space-y-6" data-testid="performance-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Minha Performance</h1>
        <p className="text-gray-500 mt-1">
          Acompanhe suas metas e comissões - {performance.mes}/{performance.ano}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Bônus Conquistado</CardTitle>
            <Award className="w-5 h-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(bonusAtingido)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {bonusAtingido > 0 ? 'Parabéns! 🎉' : 'Continue vendendo!'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total a Receber</CardTitle>
            <DollarSign className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalGanhos)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Vendas + Bônus</p>
          </CardContent>
        </Card>
      </div>

{/* Progresso por Níveis de Bonificação */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Conquistas e Bônus</CardTitle>
          <CardDescription>Acompanhe seu progresso para cada prêmio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            
            {/* TRAVA DE SEGURANÇA: Só renderiza se existir configuração */}
            {!comissaoConfig || !comissaoConfig.bonus_tiers ? (
              <div className="text-center py-4 text-gray-500">
                <p>Carregando dados das metas...</p>
              </div>
            ) : (
              // Se os dados existem, renderiza o loop
              comissaoConfig.bonus_tiers
                .sort((a, b) => a.percentual_meta - b.percentual_meta)
                .map((tier, index) => {
                  
                  // Proteção contra divisão por zero ou valores nulos
                  const metaDoNivel = tier.percentual_meta || 100;
                  const atual = percentualAtingido || 0;

                  // Matemática do progresso
                  let progressoNesteNivel = (atual / metaDoNivel) * 100;
                  progressoNesteNivel = Math.min(Math.max(progressoNesteNivel, 0), 100);
                  
                  const isConquistado = progressoNesteNivel >= 100;

                  return (
                    <div key={index} className="relative">
                      {/* Cabeçalho da Barra Individual */}
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <span className="text-sm font-bold text-gray-800 block">
                            Nível {index + 1} 
                            {isConquistado && <span className="ml-2 text-green-600 text-xs">✅ Conquistado!</span>}
                          </span>
                          <span className="text-xs text-gray-500">
                            Prêmio: <span className="font-semibold text-green-600">
                              {/* Garante que formatCurrency existe antes de chamar */}
                              {typeof formatCurrency === 'function' ? formatCurrency(tier.valor_bonus) : `R$ ${tier.valor_bonus}`}
                            </span>
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {Math.floor(progressoNesteNivel)}% concluído
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                        <div
                          className={`h-full transition-all duration-700 ${
                            isConquistado 
                              ? 'bg-green-500' 
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${progressoNesteNivel}%` }}
                        ></div>
                      </div>
                      
                      {!isConquistado && (
                        <p className="text-[10px] text-gray-400 mt-1 text-right">
                          
                        </p>
                      )}
                    </div>
                  );
                })
            )}
{/* Barra Final: Meta Global (100%) */}
            <div className="pt-4 border-t border-gray-100 mt-4">
              
              
            </div>

          </div>
        </CardContent>
      </Card>
      
    </div>
            
  );
}
