import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { customersAPI, salesAPI, storeCreditsAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useFilial } from '@/context/FilialContext';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, CreditCard, Smartphone, Gift, RefreshCw, User, CalendarIcon } from 'lucide-react';
import api from '@/lib/api';

export default function SalesAdvanced() {
  const [customers, setCustomers] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // Data e Manual Price
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualPriceOpen, setManualPriceOpen] = useState(false);
  const [manualPriceValue, setManualPriceValue] = useState('');
  const [manualProductTemp, setManualProductTemp] = useState(null);

  // Payment states
  const [paymentMode, setPaymentMode] = useState('single');
  const [singlePayment, setSinglePayment] = useState(''); // Começa vazio para obrigar seleção
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
  const isAdminOrManager = user.role === 'admin' || user.role === 'gerente';
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (selectedFilial) {
      loadCustomers();
      loadVendedores();
    }
  }, [selectedFilial]);

  useEffect(() => {
    if (vendedores.length > 0 && user.role === 'vendedora') {
      const currentVendedor = vendedores.find(v => v.id === user.id || v.username === user.username);
      if (currentVendedor && !selectedVendedor) {
        setSelectedVendedor(currentVendedor.id);
      }
    }
  }, [vendedores, user.id, user.username]);

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

  const handleBarcodeChange = async (value) => {
    setBarcodeInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.trim().length >= 1) { 
      searchTimeoutRef.current = setTimeout(async () => {
        try {
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
    if (product.codigo === '0') {
      setManualProductTemp(product);
      setManualPriceValue('');
      setManualPriceOpen(true);
    } else {
      addToCart(product);
    }
    setBarcodeInput('');
    setSearchResults([]);
    setShowResults(false);
  };

  const confirmManualPrice = () => {
    if (!manualProductTemp) return;
    const price = parseFloat(manualPriceValue);
    if (isNaN(price) || price <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido' });
      return;
    }
    const productWithPrice = { ...manualProductTemp, preco_venda: price };
    addToCart(productWithPrice);
    setManualPriceOpen(false);
    setManualProductTemp(null);
  };

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const response = await api.get(`/products/barcode/${barcodeInput.trim()}`);
      const product = response.data;
      
      if (product.filial_id !== selectedFilial.id) {
        toast({ variant: 'destructive', title: 'Produto de outra filial' });
        setBarcodeInput('');
        return;
      }
      
      if (product.codigo === '0') {
        setManualProductTemp(product);
        setManualPriceValue('');
        setManualPriceOpen(true);
      } else {
        addToCart(product);
      }
      setBarcodeInput('');
      setSearchResults([]);
      setShowResults(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Produto não encontrado' });
      setBarcodeInput('');
    }
  };

  const addToCart = (product) => {
    const isManual = product.codigo === '0';
    const cartItemId = isManual ? `manual-${Date.now()}-${Math.random()}` : product.id;
    const existingItem = !isManual ? cart.find((item) => item.product_id === product.id) : null;
    
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantidade + 1);
    } else {
      setCart([...cart, {
        cart_item_id: cartItemId,
        product_id: product.id,
        codigo: product.codigo,
        descricao: product.descricao,
        quantidade: 1,
        preco_venda: product.preco_venda,
        preco_custo: product.preco_custo,
        subtotal: product.preco_venda,
      }]);
    }
  };

  const updateQuantity = (identifier, newQuantity, isCartItemId = false) => {
    if (newQuantity <= 0) { removeFromCart(identifier, isCartItemId); return; }
    setCart(cart.map((item) => {
        const match = isCartItemId ? item.cart_item_id === identifier : item.product_id === identifier;
        return match ? { ...item, quantidade: newQuantity, subtotal: item.preco_venda * newQuantity } : item;
    }));
  };

  const removeFromCart = (identifier, isCartItemId = false) => {
    setCart(cart.filter((item) => {
        return isCartItemId ? item.cart_item_id !== identifier : item.product_id !== identifier;
    }));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTotal = () => {
    let total = calculateSubtotal() - discount;
    if (useStoreCredit && customerData && !isTroca) { // Crédito não aplicável se for troca
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
      toast({ variant: 'destructive', title: 'Carrinho vazio' });
      return;
    }

    if (!selectedVendedor) {
      toast({ variant: 'destructive', title: 'Vendedor não selecionado' });
      return;
    }

    const total = calculateTotal();

    // Valida pagamento misto APENAS se não for troca
    if (!isTroca && paymentMode === 'mixed') {
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
      const vendedorSelecionado = vendedores.find(v => v.id === selectedVendedor || v.username === selectedVendedor);
      const vendedorNome = vendedorSelecionado ? vendedorSelecionado.full_name : user.full_name;
      
      const saleData = {
        items: cart,
        total: total,
        // Se for troca, força a modalidade 'Troca' no backend
        modalidade_pagamento: isTroca ? 'Troca' : (paymentMode === 'mixed' ? 'Misto' : singlePayment),
        pagamentos: (!isTroca && paymentMode === 'mixed') ? mixedPayments : [],
        parcelas: (!isTroca && paymentMode === 'single') ? installments : 1,
        desconto: discount,
        vendedor: vendedorNome,
        vendedor_id: selectedVendedor || user.id,
        customer_id: selectedCustomer !== 'none' ? selectedCustomer : null,
        online: isOnline,
        encomenda: isEncomenda,
        is_troca: isTroca,
        filial_id: selectedFilial.id,
        data: isAdminOrManager ? new Date(`${customDate}T12:00:00`).toISOString() : null,
      };

      const sale = await salesAPI.create(saleData);

      if (!isTroca && useStoreCredit && customerData && storeCreditAmount > 0) {
        const newCredit = customerData.credito_loja - storeCreditAmount;
        await customersAPI.update(selectedCustomer, { ...customerData, credito_loja: newCredit });
      }

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

      resetForm();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar',
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
    setSinglePayment(''); 
    setMixedPayments([{ modalidade: 'Dinheiro', valor: 0, parcelas: 1 }]);
    setInstallments(1);
  };

  const total = calculateTotal();
  const subtotal = calculateSubtotal();
  const availableCredit = customerData?.credito_loja || 0;
  const maxCreditUsable = Math.min(availableCredit, total);

  // --- LÓGICA DE VALIDAÇÃO DO BOTÃO FINALIZAR ---
  const isCreditWithoutCustomer = !isTroca && paymentMode === 'single' && singlePayment === 'Credito' && selectedCustomer === 'none';
  const isPaymentSelected = paymentMode === 'mixed' ? true : singlePayment !== '';
  // Se for Troca, ignora pagamento. Se for Venda, exige pagamento.
  const canFinalize = cart.length > 0 && (isTroca || isPaymentSelected) && !isCreditWithoutCustomer;
  // ----------------------------------------------

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">PDV - Ponto de Venda</h1>
        <p className="text-gray-500 mt-1">Sistema de vendas rápido</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Barcode Scanner & Product List */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Escanear Código de Barras</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input placeholder="Digite o código (Use '0' para manual)..." value={barcodeInput} onChange={(e) => handleBarcodeChange(e.target.value)} onBlur={() => setTimeout(() => setShowResults(false), 200)} onFocus={() => searchResults.length > 0 && setShowResults(true)} className="text-lg" autoFocus />
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                        {searchResults.map((product) => (
                          <div key={product.id} onMouseDown={(e) => { e.preventDefault(); handleSelectProduct(product); }} className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0">
                            <div className="flex justify-between items-start">
                              <div><p className="font-medium text-gray-900">{product.descricao}</p><p className="text-sm text-gray-500">{product.codigo}</p></div>
                              <p className="font-bold text-indigo-600">{formatCurrency(product.preco_venda)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit"><Plus className="w-4 h-4" /></Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Carrinho ({cart.length} itens)</CardTitle></CardHeader>
            <CardContent>
              {cart.length === 0 ? <div className="text-center py-12 text-gray-500">Carrinho vazio.</div> : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.cart_item_id || item.product_id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1"><p className="font-medium text-gray-900">{item.descricao}</p><p className="text-sm text-gray-500">Código: {item.codigo}</p><p className="text-sm font-medium text-indigo-600">{formatCurrency(item.preco_venda)} cada</p></div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => updateQuantity(item.cart_item_id || item.product_id, item.quantidade - 1, !!item.cart_item_id)}><Minus className="w-4 h-4" /></Button>
                        <span className="w-12 text-center font-medium">{item.quantidade}</span>
                        <Button variant="outline" size="icon" onClick={() => updateQuantity(item.cart_item_id || item.product_id, item.quantidade + 1, !!item.cart_item_id)}><Plus className="w-4 h-4" /></Button>
                      </div>
                      <div className="text-right"><p className="font-bold text-lg">{formatCurrency(item.subtotal)}</p></div>
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.cart_item_id || item.product_id, !!item.cart_item_id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
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
            <CardHeader><CardTitle>Finalizar Venda</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              
              {isAdminOrManager && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <Label className="flex items-center gap-2 text-yellow-800 font-bold"><CalendarIcon className="w-4 h-4" /> Data da Venda (Retroativa)</Label>
                  <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="bg-white" />
                </div>
              )}

              <div className="space-y-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <Label className="flex items-center gap-2 text-indigo-900"><User className="w-4 h-4" /> Vendedor Responsável *</Label>
                <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                  <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                  <SelectContent>
                    {vendedores.map((vendedor) => (<SelectItem key={vendedor.id} value={vendedor.id}>{vendedor.full_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cliente (Opcional)</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {customers.map((customer) => (<SelectItem key={customer.id} value={customer.id}>{customer.nome} {customer.cpf && `- ${customer.cpf}`}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {/* CHECKBOX DE TROCA MOVIDO PARA CÁ */}
              <div className="space-y-2">
                <label className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isTroca ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                  <input
                    type="checkbox"
                    checked={isTroca}
                    onChange={(e) => setIsTroca(e.target.checked)}
                    disabled={selectedCustomer === 'none'}
                    className="rounded w-4 h-4 text-yellow-600"
                  />
                  <span className="text-sm font-bold flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" />
                    TROCA (Gera crédito para o cliente)
                  </span>
                </label>
                {isTroca && selectedCustomer === 'none' && (
                  <p className="text-xs text-red-500 ml-1">Selecione um cliente para habilitar troca.</p>
                )}
              </div>

              {/* SE FOR TROCA, ESCONDE TUDO ISSO ABAIXO */}
              {!isTroca && (
                <>
                  {customerData && customerData.credito_loja > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><Gift className="w-4 h-4" /> Crédito: {formatCurrency(availableCredit)}</Label>
                        <input type="checkbox" checked={useStoreCredit} onChange={(e) => { setUseStoreCredit(e.target.checked); setStoreCreditAmount(e.target.checked ? maxCreditUsable : 0); }} className="rounded" />
                      </div>
                      {useStoreCredit && <Input type="number" step="0.01" max={maxCreditUsable} value={storeCreditAmount} onChange={(e) => setStoreCreditAmount(Math.min(parseFloat(e.target.value) || 0, maxCreditUsable))} />}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Modo de Pagamento</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="single">Pagamento Único</SelectItem><SelectItem value="mixed">Pagamento Misto</SelectItem></SelectContent>
                    </Select>
                  </div>

                  {paymentMode === 'single' && (
                    <>
                      <div className="space-y-2">
                        <Label>Forma de Pagamento</Label>
                        <Select value={singlePayment} onValueChange={setSinglePayment}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="Cartao">Cartão</SelectItem>
                            <SelectItem value="Pix">Pix</SelectItem>
                            <SelectItem value="Credito">A Prazo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(singlePayment === 'Cartao' || singlePayment === 'Credito') && (
                        <div className="space-y-2">
                          <Label>Parcelas</Label>
                          <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (<SelectItem key={n} value={n.toString()}>{n}x {formatCurrency(total / n)}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}

                  {paymentMode === 'mixed' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center"><Label>Formas de Pagamento</Label><Button type="button" size="sm" variant="outline" onClick={addMixedPayment}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button></div>
                      {mixedPayments.map((payment, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2">
                          <div className="flex justify-between items-center"><span className="text-sm font-medium">Pagamento {index + 1}</span>{mixedPayments.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => removeMixedPayment(index)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}</div>
                          <Select value={payment.modalidade} onValueChange={(v) => updateMixedPayment(index, 'modalidade', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Dinheiro">Dinheiro</SelectItem><SelectItem value="Cartao">Cartão</SelectItem><SelectItem value="Pix">Pix</SelectItem><SelectItem value="Credito">Crédito</SelectItem></SelectContent>
                          </Select>
                          <Input type="number" step="0.01" placeholder="Valor" value={payment.valor} onChange={(e) => updateMixedPayment(index, 'valor', parseFloat(e.target.value) || 0)} />
                        </div>
                      ))}
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <div className="flex justify-between text-sm"><span>Total:</span><span className="font-bold">{formatCurrency(getTotalMixedPayments())}</span></div>
                        <div className="flex justify-between text-sm"><span>Venda:</span><span className="font-bold">{formatCurrency(total)}</span></div>
                        {Math.abs(getTotalMixedPayments() - total) > 0.01 && <p className="text-xs text-red-600 mt-1">Diferença: {formatCurrency(Math.abs(getTotalMixedPayments() - total))}</p>}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Desconto (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
                  </div>
                </>
              )}

              {/* Flags (Sempre visíveis, exceto troca que já foi movida) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2"><input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} className="rounded" /><span className="text-sm">Venda Online</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={isEncomenda} onChange={(e) => setIsEncomenda(e.target.checked)} className="rounded" /><span className="text-sm">Encomenda</span></label>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-2xl font-bold"><span>Total:</span><span className="text-indigo-600">{formatCurrency(total)}</span></div>
              </div>

              <Button
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCheckout}
                disabled={!canFinalize || processing}
                data-testid="checkout-button"
                title={!isTroca && !isPaymentSelected ? "Selecione a forma de pagamento" : isCreditWithoutCustomer ? "Identifique o cliente para venda a prazo" : "Finalizar"}
              >
                {processing ? 'Processando...' : isTroca ? 'Registrar Troca' : 'Finalizar Venda'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={manualPriceOpen} onOpenChange={setManualPriceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Venda Manual / Ajuste</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4"><div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={manualPriceValue} onChange={(e) => setManualPriceValue(e.target.value)} autoFocus /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setManualPriceOpen(false)}>Cancelar</Button><Button onClick={confirmManualPrice}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
