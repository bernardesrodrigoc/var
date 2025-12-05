import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
            <CardTitle className="text-sm font-medium text-gray-600">Total de Vendas</CardTitle>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalVendas)}</div>
            <p className="text-xs text-gray-500 mt-1">{performance.num_vendas} vendas realizadas</p>
          </CardContent>
        </Card>

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

      {/* Progresso Visual */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso da Meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Barra de progresso principal */}
            <div className="relative">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Meta do Mês</span>
                <span className="text-sm font-semibold text-indigo-600">
                  100%
                </span>
              </div>
              <div className="h-10 bg-gray-200 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 flex items-center justify-end pr-3"
                  style={{ width: `${Math.min(percentualAtingido, 100)}%` }}
                >
                  {/* Mostra a % dentro da barra se ela for grande o suficiente */}
                  {percentualAtingido >= 10 && (
                    <span className="text-white font-bold text-sm">
                      {percentualAtingido.toFixed(1)}%
                    </span>
                  )}
                </div>
                {/* Mostra a % fora da barra se ela for muito curta */}
                {percentualAtingido < 10 && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold text-sm">
                    {percentualAtingido.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Motivação Baseada em Porcentagem */}
            {(() => {
              const proximaFaixa = comissaoConfig.bonus_tiers
                .filter(t => t.percentual_meta > percentualAtingido)
                .sort((a, b) => a.percentual_meta - b.percentual_meta)[0];
              
              if (proximaFaixa) {
                // Calcula quanto falta em % para o próximo nível
                const faltaPercentual = proximaFaixa.percentual_meta - percentualAtingido;
                
                return (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-700">
                      🎯 <strong>Falta apenas {faltaPercentual.toFixed(1)}%</strong> da meta para você conquistar mais{' '}
                      <strong className="text-green-600">{formatCurrency(proximaFaixa.valor_bonus)}</strong> de bônus!
                    </p>
                  </div>
                );
              } else if (percentualAtingido >= 100) {
                return (
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-500">
                    <p className="text-sm font-bold text-yellow-800">
                      🎉 Parabéns! Você bateu a meta (100%) e conquistou {formatCurrency(bonusAtingido)} de bônus!
                    </p>
                  </div>
                );
              } else {
                // Caso padrão: quanto falta para 100%
                const faltaParaCem = 100 - percentualAtingido;
                return (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-700">
                      💪 Continue assim! Faltam <strong>{faltaParaCem.toFixed(1)}%</strong> para bater sua meta total!
                    </p>
                  </div>
                );
              }
            })()}
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
