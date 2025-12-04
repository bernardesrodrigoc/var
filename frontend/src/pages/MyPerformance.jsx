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
                  {formatCurrency(meta)}
                </span>
              </div>
              <div className="h-10 bg-gray-200 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 flex items-center justify-end pr-3"
                  style={{ width: `${Math.min(percentualAtingido, 100)}%` }}
                >
                  {percentualAtingido >= 10 && (
                    <span className="text-white font-bold text-sm">
                      {formatCurrency(totalVendas)}
                    </span>
                  )}
                </div>
                {percentualAtingido < 10 && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold text-sm">
                    {formatCurrency(totalVendas)}
                  </span>
                )}
              </div>
            </div>

            {/* Motivação */}
            {(() => {
              const proximaFaixa = comissaoConfig.bonus_tiers
                .filter(t => t.percentual_meta > percentualAtingido)
                .sort((a, b) => a.percentual_meta - b.percentual_meta)[0];
              
              if (proximaFaixa) {
                const faltaVender = ((proximaFaixa.percentual_meta / 100) * meta) - totalVendas;
                return (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-700">
                      🎯 <strong>Falta apenas {formatCurrency(Math.max(0, faltaVender))}</strong> para você conquistar mais{' '}
                      <strong className="text-green-600">{formatCurrency(proximaFaixa.valor_bonus)}</strong> de bônus!
                    </p>
                  </div>
                );
              } else if (percentualAtingido >= 100) {
                return (
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-500">
                    <p className="text-sm font-bold text-yellow-800">
                      🎉 Parabéns! Você bateu a meta e conquistou {formatCurrency(bonusAtingido)} de bônus!
                    </p>
                  </div>
                );
              } else {
                const faltaParaMeta = meta - performance.total_vendas;
                return (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-700">
                      💪 Continue assim! Faltam <strong>{formatCurrency(Math.max(0, faltaParaMeta))}</strong> para bater sua meta!
                    </p>
                  </div>
                );
              }
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Metas de Bonificação */}
      <Card>
        <CardHeader>
          <CardTitle>Metas de Bonificação 🎁</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comissaoConfig.bonus_tiers
              .sort((a, b) => a.percentual_meta - b.percentual_meta)
              .map((tier, index) => {
                const valorMeta = (tier.percentual_meta / 100) * meta;
                const isAtingida = totalVendas >= valorMeta;
                const isAtual = bonusAtingido === tier.valor_bonus && isAtingida;
                
                return (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      isAtual 
                        ? 'bg-green-50 border-green-500' 
                        : isAtingida 
                        ? 'bg-gray-100 border-gray-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {isAtual && '⭐ '}Meta {index + 1}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Vendas de {formatCurrency(valorMeta)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          isAtual ? 'text-green-600' : 'text-purple-600'
                        }`}>
                          {formatCurrency(tier.valor_bonus)}
                        </p>
                        {isAtingida && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            {isAtual ? '✓ Conquistado!' : '✓ Atingido'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
