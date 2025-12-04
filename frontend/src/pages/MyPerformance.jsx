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

  if (!performance) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-500">Erro ao carregar dados</div>
      </div>
    );
  }

  const getTierInfo = (tier) => {
    const tiers = {
      0: { name: 'Sem Bônus', color: 'bg-gray-400', bonus: 0, minPercent: 0 },
      1: { name: 'Bronze', color: 'bg-orange-600', bonus: 40, minPercent: 16 },
      2: { name: 'Prata', color: 'bg-gray-400', bonus: 100, minPercent: 27 },
      3: { name: 'Ouro', color: 'bg-yellow-500', bonus: 180, minPercent: 37 },
      4: { name: 'Diamante', color: 'bg-blue-600', bonus: 430, minPercent: 68 },
    };
    return tiers[tier] || tiers[0];
  };

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
              {formatCurrency(performance.bonus_valor)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Comissão Total</CardTitle>
            <DollarSign className="w-5 h-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(performance.comissao_total)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Vendas + Bônus</p>
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

            {performance.tier_atual < 4 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Falta {performance.falta_percentual_proxima_etapa.toFixed(1)}%</strong> para
                  atingir o nível <strong>{nextTierInfo.name}</strong> e ganhar mais{' '}
                  <strong>{formatCurrency(nextTierInfo.bonus - tierInfo.bonus)}</strong> de bônus!
                </p>
              </div>
            )}
            
            {performance.tier_atual === 4 && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-500">
                <p className="text-sm font-bold text-yellow-800">
                  🎉 Parabéns! Você atingiu o nível máximo (Diamante) com {formatCurrency(performance.bonus_valor)} de bônus!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
