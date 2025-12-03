import { createContext, useContext, useState, useEffect } from 'react';

const FilialContext = createContext();

export function FilialProvider({ children }) {
  const [selectedFilial, setSelectedFilial] = useState(null);
  const [filiais, setFiliais] = useState([]);

  useEffect(() => {
    // Carregar filial selecionada do localStorage ao iniciar
    const saved = localStorage.getItem('selected_filial');
    if (saved) {
      setSelectedFilial(JSON.parse(saved));
    }
  }, []);

  const selectFilial = (filial) => {
    setSelectedFilial(filial);
    localStorage.setItem('selected_filial', JSON.stringify(filial));
  };

  const clearFilial = () => {
    setSelectedFilial(null);
    localStorage.removeItem('selected_filial');
  };

  return (
    <FilialContext.Provider value={{ selectedFilial, selectFilial, clearFilial, filiais, setFiliais }}>
      {children}
    </FilialContext.Provider>
  );
}

export function useFilial() {
  const context = useContext(FilialContext);
  if (!context) {
    throw new Error('useFilial deve ser usado dentro de um FilialProvider');
  }
  return context;
}
