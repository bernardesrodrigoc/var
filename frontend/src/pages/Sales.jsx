import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { productsAPI, customersAPI, salesAPI, storeCreditsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, CreditCard, Smartphone, Gift, RefreshCw, User } from 'lucide-react';
import api from '@/lib/api';

export default function SalesAdvanced() {
  const [customers, setCustomers] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // Payment states
  const [paymentMode, setPaymentMode] = useState('single'); // 'single' or 'mixed'
  const [singlePayment, setSinglePayment] = useState('Dinheiro');
  const [mixedPayments, setMixedPayments] = useState([
    { modalidade: 'Dinheiro', valor: 0, parcelas: 1 }
  ]);
  
  const [installments, setInstallments] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState('none');
  const [customerData, setCustomerData] = useState(null);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [isEncomenda, setIsEncomenda] = useState(false);
  const [isTroca, setIsTroca] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const { toast } = useToast();
  const { selectedFilial } = useFilial();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (selectedFilial) {
      loadCustomers();
      loadVendedores();
      
      // Se o usuário é vendedora, selecionar automaticamente
      if (user.role === 'vendedora') {
        setSelectedVendedor(user.id || user.username);
      }
    }
  }, [selectedFilial]);

  useEffect(() => {
    if (selectedCustomer !== 'none') {
      loadCustomerData();
    } else {
      setCustomerData(null);
      setUseStoreCredit(false);
    }
  }, [selectedCustomer]);

  const loadVendedores = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data;
      // Filtrar apenas vendedores da filial atual
      const vendedoresDaFilial = allUsers.filter(u => 
        u.role === 'vendedora' && u.filial_id === selectedFilial.id && u.active
      );
      setVendedores(vendedoresDaFilial);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
    }
  };

  const loadCustomers = async () => {
    if (!selectedFilial) return;
    
    try {
      const response = await api.get(`/customers?filial_id=${selectedFilial.id}`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadCustomerData = async () => {
    try {
      const data = await customersAPI.getById(selectedCustomer);
      setCustomerData(data);
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    }
  };

  // Autocomplete search
  const handleBarcodeChange = async (value) => {
    setBarcodeInput(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          // Buscar produtos da filial atual
          const response = await api.get(`/products/search/${value.trim()}?filial_id=${selectedFilial.id}`);
          setSearchResults(response.data);
          setShowResults(true);
        } catch (error) {
          setSearchResults([]);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleSelectProduct = (product) => {
    addToCart(product);
    setBarcodeInput('');
    setSearchResults([]);
    setShowResults(false);
  };

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      // Buscar produto por código de barras na filial atual
      const response = await api.get(`/products/barcode/${barcodeInput.trim()}`);
      const product = response.data;
      
      // Verificar se o produto pertence à filial atual
      if (product.filial_id !== selectedFilial.id) {
        toast({
          variant: 'destructive',
          title: 'Produto de outra filial',
          description: 'Este produto não está disponível nesta filial',
        });
        setBarcodeInput('');
        return;
      }
      
      addToCart(product);
      setBarcodeInput('');
      setSearchResults([]);
      setShowResults(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Produto não encontrado',
        description: `Código: ${barcodeInput}`,
      });
      setBarcodeInput('');
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantidade + 1);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          codigo: product.codigo,
          descricao: product.descricao,
          quantidade: 1,
          preco_venda: product.preco_venda,
          preco_custo: product.preco_custo,
          subtotal: product.preco_venda,
        },
      ]);
    }
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.product_id === productId
          ? { ...item, quantidade: newQuantity, subtotal: item.preco_venda * newQuantity }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTotal = () => {
    let total = calculateSubtotal() - discount;
    if (useStoreCredit && customerData) {
      total -= storeCreditAmount;
    }
    return Math.max(0, total);
  };

  const addMixedPayment = () => {
    setMixedPayments([...mixedPayments, { modalidade: 'Dinheiro', valor: 0, parcelas: 1 }]);
  };

  const removeMixedPayment = (index) => {
    if (mixedPayments.length > 1) {
      setMixedPayments(mixedPayments.filter((_, i) => i !== index));
    }
  };

  const updateMixedPayment = (index, field, value) => {
    const updated = [...mixedPayments];
    updated[index][field] = value;
    setMixedPayments(updated);
  };

  const getTotalMixedPayments = () => {
    return mixedPayments.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Carrinho vazio',
        description: 'Adicione produtos antes de finalizar a venda',
      });
      return;
    }

    // Validar seleção de vendedor (admin/gerente devem selecionar)
    if ((user.role === 'admin' || user.role === 'gerente') && !selectedVendedor) {
      toast({
        variant: 'destructive',
        title: 'Vendedor não selecionado',
        description: 'Selecione o vendedor responsável pela venda',
      });
      return;
    }

    const total = calculateTotal();

    // Validate mixed payments
    if (paymentMode === 'mixed') {
      const totalPaid = getTotalMixedPayments();
      if (Math.abs(totalPaid - total) > 0.01) {
        toast({
          variant: 'destructive',
          title: 'Valor incorreto',
          description: `Total dos pagamentos (${formatCurrency(totalPaid)}) diferente do total da venda (${formatCurrency(total)})`,
        });
        return;
      }
    }

    setProcessing(true);
    try {
      // Obter nome do vendedor selecionado
      const vendedorSelecionado = vendedores.find(v => v.id === selectedVendedor || v.username === selectedVendedor);
      const vendedorNome = vendedorSelecionado ? vendedorSelecionado.full_name : user.full_name;
      
      const saleData = {
        items: cart,
        total: total,
        modalidade_pagamento: paymentMode === 'mixed' ? 'Misto' : singlePayment,
        pagamentos: paymentMode === 'mixed' ? mixedPayments : [],
        parcelas: paymentMode === 'single' ? installments : 1,
        desconto: discount,
        vendedor: vendedorNome,
        vendedor_id: selectedVendedor || user.id,
        customer_id: selectedCustomer !== 'none' ? selectedCustomer : null,
        online: isOnline,
        encomenda: isEncomenda,
        is_troca: isTroca,
        filial_id: selectedFilial.id,
      };

      const sale = await salesAPI.create(saleData);

      // If using store credit, deduct from customer
      if (useStoreCredit && customerData && storeCreditAmount > 0) {
        const newCredit = customerData.credito_loja - storeCreditAmount;
        await customersAPI.update(selectedCustomer, { ...customerData, credito_loja: newCredit });
      }

      // If it's a troca (exchange), create store credit
      if (isTroca && selectedCustomer !== 'none') {
        await storeCreditsAPI.create({
          customer_id: selectedCustomer,
          valor: total,
          origem: 'troca',
          observacoes: 'Crédito gerado por troca de produtos',
          venda_origem_id: sale.id,
        });
        
        toast({
          title: 'Troca registrada!',
          description: `Crédito de ${formatCurrency(total)} gerado para o cliente`,
        });
      } else {
        toast({
          title: 'Venda realizada com sucesso!',
          description: `Total: ${formatCurrency(total)}`,
        });
      }

      // Reset form
      resetForm();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar venda',
        description: error.response?.data?.detail || 'Tente novamente',
      });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setDiscount(0);
    setSelectedCustomer('none');
    setCustomerData(null);
    setUseStoreCredit(false);
    setStoreCreditAmount(0);
    setIsOnline(false);
    setIsEncomenda(false);
    setIsTroca(false);
    setPaymentMode('single');
    setSinglePayment('Dinheiro');
    setMixedPayments([{ modalidade: 'Dinheiro', valor: 0, parcelas: 1 }]);
    setInstallments(1);
  };

  const total = calculateTotal();
  const subtotal = calculateSubtotal();
  const availableCredit = customerData?.credito_loja || 0;
  const maxCreditUsable = Math.min(availableCredit, total);

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">PDV - Ponto de Venda</h1>
        <p className="text-gray-500 mt-1">Sistema de vendas rápido com pagamento misto</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Barcode Scanner & Product List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode Scanner with Autocomplete */}
          <Card>
            <CardHeader>
              <CardTitle>Escanear Código de Barras</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Digite ou escaneie o código..."
                      value={barcodeInput}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowResults(false), 200)}
                      onFocus={() => searchResults.length > 0 && setShowResults(true)}
                      data-testid="barcode-input"
                      className="text-lg"
                      autoFocus
                    />
                    
                    {/* Autocomplete Results */}
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                        {searchResults.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleSelectProduct(product)}
                            className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{product.descricao}</p>
                                <p className="text-sm text-gray-500">Código: {product.codigo}</p>
                                <p className="text-sm text-gray-500">Estoque: {product.quantidade}</p>
                              </div>
                              <p className="font-bold text-indigo-600">{formatCurrency(product.preco_venda)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit" data-testid="add-to-cart-button">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Carrinho ({cart.length} itens)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Carrinho vazio. Adicione produtos para iniciar a venda.
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                      data-testid={`cart-item-${item.codigo}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.descricao}</p>
                        <p className="text-sm text-gray-500">Código: {item.codigo}</p>
                        <p className="text-sm font-medium text-indigo-600">
                          {formatCurrency(item.preco_venda)} cada
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product_id, item.quantidade - 1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">{item.quantidade}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product_id, item.quantidade + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(item.subtotal)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.product_id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Checkout */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Finalizar Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vendedor Selector (for admin/gerente) */}
              {(user.role === 'admin' || user.role === 'gerente') && (
                <div className="space-y-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <Label className="flex items-center gap-2 text-indigo-900">
                    <User className="w-4 h-4" />
                    Vendedor Responsável *
                  </Label>
                  <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendedores.map((vendedor) => (
                        <SelectItem key={vendedor.id} value={vendedor.id}>
                          {vendedor.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Customer */}
              <div className="space-y-2">
                <Label>Cliente (Opcional)</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.nome} {customer.cpf && `- ${customer.cpf}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Store Credit */}
              {customerData && customerData.credito_loja > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      Crédito Disponível: {formatCurrency(availableCredit)}
                    </Label>
                    <input
                      type="checkbox"
                      checked={useStoreCredit}
                      onChange={(e) => {
                        setUseStoreCredit(e.target.checked);
                        if (e.target.checked) {
                          setStoreCreditAmount(maxCreditUsable);
                        } else {
                          setStoreCreditAmount(0);
                        }
                      }}
                      className="rounded"
                    />
                  </div>
                  {useStoreCredit && (
                    <Input
                      type="number"
                      step="0.01"
                      max={maxCreditUsable}
                      value={storeCreditAmount}
                      onChange={(e) => setStoreCreditAmount(Math.min(parseFloat(e.target.value) || 0, maxCreditUsable))}
                      placeholder="Valor do crédito a usar"
                    />
                  )}
                </div>
              )}

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label>Modo de Pagamento</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Pagamento Único</SelectItem>
                    <SelectItem value="mixed">Pagamento Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Single Payment */}
              {paymentMode === 'single' && (
                <>
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={singlePayment} onValueChange={setSinglePayment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dinheiro">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Dinheiro
                          </div>
                        </SelectItem>
                        <SelectItem value="Cartao">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Cartão
                          </div>
                        </SelectItem>
                        <SelectItem value="Pix">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            Pix
                          </div>
                        </SelectItem>
                        <SelectItem value="Credito">Crédito da Loja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(singlePayment === 'Cartao' || singlePayment === 'Credito') && (
                    <div className="space-y-2">
                      <Label>Parcelas</Label>
                      <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n}x {formatCurrency(total / n)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {/* Mixed Payment */}
              {paymentMode === 'mixed' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Formas de Pagamento</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addMixedPayment}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {mixedPayments.map((payment, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Pagamento {index + 1}</span>
                        {mixedPayments.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeMixedPayment(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                      <Select
                        value={payment.modalidade}
                        onValueChange={(v) => updateMixedPayment(index, 'modalidade', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="Cartao">Cartão</SelectItem>
                          <SelectItem value="Pix">Pix</SelectItem>
                          <SelectItem value="Credito">Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Valor"
                        value={payment.valor}
                        onChange={(e) => updateMixedPayment(index, 'valor', parseFloat(e.target.value) || 0)}
                      />
                      {(payment.modalidade === 'Cartao' || payment.modalidade === 'Credito') && (
                        <Select
                          value={payment.parcelas.toString()}
                          onValueChange={(v) => updateMixedPayment(index, 'parcelas', parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Parcelas" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Total Pagamentos:</span>
                      <span className="font-bold">{formatCurrency(getTotalMixedPayments())}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Venda:</span>
                      <span className="font-bold">{formatCurrency(total)}</span>
                    </div>
                    {Math.abs(getTotalMixedPayments() - total) > 0.01 && (
                      <p className="text-xs text-red-600 mt-1">
                        Diferença: {formatCurrency(Math.abs(getTotalMixedPayments() - total))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Discount */}
              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Flags */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isOnline}
                    onChange={(e) => setIsOnline(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Venda Online</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isEncomenda}
                    onChange={(e) => setIsEncomenda(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Encomenda</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isTroca}
                    onChange={(e) => setIsTroca(e.target.checked)}
                    disabled={selectedCustomer === 'none'}
                    className="rounded"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" />
                    Troca (gera crédito)
                  </span>
                </label>
              </div>

              {/* Total */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto:</span>
                    <span>- {formatCurrency(discount)}</span>
                  </div>
                )}
                {useStoreCredit && storeCreditAmount > 0 && (
                  <div className="flex justify-between text-sm text-purple-600">
                    <span>Crédito da Loja:</span>
                    <span>- {formatCurrency(storeCreditAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total:</span>
                  <span className="text-indigo-600">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                className="w-full h-12 text-lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || processing}
                data-testid="checkout-button"
              >
                {processing ? 'Processando...' : isTroca ? 'Registrar Troca' : 'Finalizar Venda'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
