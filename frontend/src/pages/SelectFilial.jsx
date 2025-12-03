import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFilial } from '@/context/FilialContext';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Store, LogOut } from 'lucide-react';

export default function SelectFilial() {
  const [loading, setLoading] = useState(true);
  const [filiais, setFiliais] = useState([]);
  const { selectFilial } = useFilial();
  const navigate = useNavigate();
  const { toast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadFiliais();
  }, []);

  const loadFiliais = async () => {
    try {
      const response = await api.get('/filiais');
      const allFiliais = response.data;
      
      // Filtrar filiais baseado no perfil do usuário
      let availableFiliais = allFiliais;
      
      // Admin vê todas as filiais
      if (currentUser.role === 'admin') {
        availableFiliais = allFiliais;
      }
      // Gerentes veem suas filiais de acesso (se definido) ou sua filial principal
      else if (currentUser.role === 'gerente') {
        if (currentUser.filiais_acesso && currentUser.filiais_acesso.length > 0) {
          availableFiliais = allFiliais.filter(f => currentUser.filiais_acesso.includes(f.id));
        } else if (currentUser.filial_id) {
          availableFiliais = allFiliais.filter(f => f.id === currentUser.filial_id);
        }
      }
      // Vendedoras veem APENAS sua filial atribuída
      else if (currentUser.role === 'vendedora') {
        if (currentUser.filial_id) {
          availableFiliais = allFiliais.filter(f => f.id === currentUser.filial_id);
        } else {
          // Se vendedora não tem filial atribuída, não pode acessar nenhuma
          availableFiliais = [];
        }
      }
      
      setFiliais(availableFiliais);
      
      // Se o usuário tem apenas uma filial disponível, selecionar automaticamente
      if (availableFiliais.length === 1) {
        handleSelectFilial(availableFiliais[0]);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as filiais',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFilial = (filial) => {
    selectFilial(filial);
    toast({
      title: 'Filial selecionada',
      description: `Você está trabalhando em: ${filial.nome}`,
    });
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selected_filial');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando filiais...</p>
        </div>
      </div>
    );
  }

  if (filiais.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Nenhuma Filial Disponível</CardTitle>
            <CardDescription className="text-center">
              Você não tem acesso a nenhuma filial. Entre em contato com o administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ExploTrack</h1>
          <p className="text-gray-600">Olá, {currentUser.full_name}! Selecione a filial para continuar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filiais.map((filial) => (
            <Card
              key={filial.id}
              className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-indigo-500"
              onClick={() => handleSelectFilial(filial)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Store className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{filial.nome}</CardTitle>
                    <CardDescription className="text-sm">
                      {filial.endereco || 'Sem endereço'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Selecionar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button onClick={handleLogout} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sair do Sistema
          </Button>
        </div>
      </div>
    </div>
  );
}
