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
  const comissaoBase = (performance.total_vendas * comissaoConfig.percentual_comissao) / 100;

  // Calcular bônus baseado na configuração (maior faixa atingida)
  const percentualAtingido = performance.goal > 0 ? (performance.total_vendas / performance.goal) * 100 : 0;
  
  let bonusAtingido = 0;
  const sortedTiers = [...comissaoConfig.bonus_tiers].sort((a, b) => b.percentual_meta - a.percentual_meta);
  
  for (const tier of sortedTiers) {
    if (percentualAtingido >= tier.percentual_meta) {
      bonusAtingido = tier.valor_bonus;
      break;
    }
  }

  const totalGanhos = comissaoBase + bonusAtingido;

  const tierInfo = getTierInfo(performance.tier_atual);
  const nextTierInfo = getTierInfo(performance.tier_atual + 1);

  return (
    <div className="space-y-6" data-testid="performance-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Minha Performance</h1>
        <p className="text-gray-500 mt-1">
          Acompanhe suas metas e comissões - {performance.mes}/{performance.ano}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`${tierInfo.color} w-16 h-16 rounded-full flex items-center justify-center`}>
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{tierInfo.name}</h2>
                <p className="text-gray-500">Nível {performance.tier_atual} de 4</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Bônus Acumulado</p>
              <p className="text-3xl font-bold text-indigo-600">{formatCurrency(performance.bonus_valor)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">% da Meta Base</CardTitle>
            <Target className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.percentual_atingido.toFixed(1)}%</div>
            <p className="text-xs text-gray-500 mt-1">{performance.num_vendas} vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">% Acima da Meta</CardTitle>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {performance.percentual_acima_meta > 0 ? '+' : ''}{performance.percentual_acima_meta.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Bônus Atual</CardTitle>
            <Award className="w-5 h-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(bonusAtingido)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {percentualAtingido >= comissaoConfig.bonus_tiers[comissaoConfig.bonus_tiers.length - 1]?.percentual_meta
                ? 'Máximo atingido!'
                : 'Continue vendendo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ganhos Totais</CardTitle>
            <DollarSign className="w-5 h-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totalGanhos)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Comissão ({comissaoConfig.percentual_comissao}%) + Bônus
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progresso da Meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                  style={{ width: `${Math.min(performance.percentual_atingido, 100)}%` }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white drop-shadow-lg">
                  {performance.percentual_atingido.toFixed(1)}% atingido
                </span>
              </div>
            </div>

            {/* Próxima faixa de bônus */}
            {(() => {
              const proximaFaixa = comissaoConfig.bonus_tiers
                .filter(t => t.percentual_meta > percentualAtingido)
                .sort((a, b) => a.percentual_meta - b.percentual_meta)[0];
              
              if (proximaFaixa) {
                const faltaVender = ((proximaFaixa.percentual_meta / 100) * performance.goal) - performance.total_vendas;
                return (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Venda mais {formatCurrency(faltaVender)}</strong> para atingir{' '}
                      <strong>{proximaFaixa.percentual_meta}% da meta</strong> e ganhar{' '}
                      <strong>{formatCurrency(proximaFaixa.valor_bonus)}</strong> de bônus!
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-500">
                    <p className="text-sm font-bold text-yellow-800">
                      🎉 Parabéns! Você atingiu a maior faixa de bonificação com {formatCurrency(bonusAtingido)} de bônus!
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
