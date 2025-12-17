import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { useFilial } from '@/context/FilialContext';
import { useToast } from '@/components/ui/use-toast';
import { ArrowUpRight, Calendar, User } from 'lucide-react';
import api from '@/lib/api';

export default function Transferencias() {
  const [transferencias, setTransferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const { selectedFilial } = useFilial();
  const { toast } = useToast();

  useEffect(() => {
    if (selectedFilial) {
      loadTransferencias();
    }
  }, [selectedFilial]);

  const loadTransferencias = async () => {
    try {
      const response = await api.get(`/transferencias?filial_id=${selectedFilial.id}`);
      setTransferencias(response.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o histórico.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Carregando...</div>;
  }

  const totalTransferido = transferencias.reduce((acc, curr) => acc + curr.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferências para Gerência</h1>
          <p className="text-gray-500 mt-1">Histórico de retiradas de lucro do caixa</p>
        </div>
        <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
          <ArrowUpRight className="w-5 h-5" />
          Total Listado: {formatCurrency(totalTransferido)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Retiradas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    Nenhuma transferência registrada nesta filial.
                  </TableCell>
                </TableRow>
              ) : (
                transferencias.map((transf) => (
                  <TableRow key={transf.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(transf.data).toLocaleDateString('pt-BR')} 
                        <span className="text-xs text-gray-400 ml-1">
                          {new Date(transf.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {transf.usuario}
                      </div>
                    </TableCell>
                    <TableCell>{transf.observacao || '-'}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">
                      {formatCurrency(transf.valor)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
