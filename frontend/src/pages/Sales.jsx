import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { productsAPI, customersAPI, salesAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, CreditCard, Smartphone } from 'lucide-react';

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [installments, setInstallments] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState('none');
  const [isOnline, setIsOnline] = useState(false);
  const [isEncomenda, setIsEncomenda] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, customersData] = await Promise.all([
        productsAPI.getAll(),
        customersAPI.getAll(),
      ]);
      setProducts(productsData);
      setCustomers(customersData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
      });
    }
  };

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const product = await productsAPI.getByBarcode(barcodeInput.trim());
      addToCart(product);
      setBarcodeInput('');
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

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    return subtotal - discount;
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

    setProcessing(true);
    try {
      const saleData = {
        items: cart,
        total: calculateTotal(),
        modalidade_pagamento: paymentMethod,
        parcelas: installments,
        desconto: discount,
        vendedor: user.full_name,
        customer_id: selectedCustomer !== 'none' ? selectedCustomer : null,
        online: isOnline,
        encomenda: isEncomenda,
      };

      await salesAPI.create(saleData);

      toast({
        title: 'Venda realizada com sucesso!',
        description: `Total: ${formatCurrency(calculateTotal())}`,
      });

      // Reset form
      setCart([]);
      setDiscount(0);
      setSelectedCustomer('none');
      setIsOnline(false);
      setIsEncomenda(false);
      setPaymentMethod('Dinheiro');
      setInstallments(1);
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

  const total = calculateTotal();

  return (
    <div className="space-y-6" data-testid="sales-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">PDV - Ponto de Venda</h1>
        <p className="text-gray-500 mt-1">Sistema de vendas rápido</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Barcode Scanner & Product List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode Scanner */}
          <Card>
            <CardHeader>
              <CardTitle>Escanear Código de Barras</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <Input
                  placeholder="Digite ou escaneie o código..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  data-testid="barcode-input"
                  className="flex-1 text-lg"
                  autoFocus
                />
                <Button type="submit" data-testid="add-to-cart-button">
                  <Plus className="w-4 h-4" />
                </Button>
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
                          data-testid={`decrease-qty-${item.codigo}`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-12 text-center font-medium" data-testid={`qty-${item.codigo}`}>
                          {item.quantidade}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product_id, item.quantidade + 1)}
                          data-testid={`increase-qty-${item.codigo}`}
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
                        data-testid={`remove-item-${item.codigo}`}
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
              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="payment-method-select">
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

              {/* Installments */}
              {(paymentMethod === 'Cartao' || paymentMethod === 'Credito') && (
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
                        {customer.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Discount */}
              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  data-testid="discount-input"
                />
              </div>

              {/* Flags */}
              <div className="flex gap-4">
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
              </div>

              {/* Total */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatCurrency(cart.reduce((sum, item) => sum + item.subtotal, 0))}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto:</span>
                    <span>- {formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total:</span>
                  <span className="text-indigo-600" data-testid="total-amount">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                className="w-full h-12 text-lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || processing}
                data-testid="checkout-button"
              >
                {processing ? 'Processando...' : 'Finalizar Venda'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
