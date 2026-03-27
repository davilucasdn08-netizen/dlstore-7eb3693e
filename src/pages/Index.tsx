import { useState, useMemo } from "react";
import { Search, Lock } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import AdminPanel, { type Product } from "@/components/AdminPanel";
import AdminLoginDialog from "@/components/AdminLoginDialog";

// SHA-256 hash of the admin code
const ADMIN_HASH = "a]3f8c2d9e1b7a4f6c0d5e8b2a9f1c3d7e6b4a0f5c8d2e9b1a7f3c6d0e5b8a";

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CATEGORIES = [
  "Todos",
  "Moda e Acessórios",
  "Eletrônicos e Informática",
  "Casa e Decoração",
  "Beleza e Cuidados Pessoais",
];

function loadProducts(): Product[] {
  try {
    const data = localStorage.getItem("dlstore-products");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveProducts(products: Product[]) {
  localStorage.setItem("dlstore-products", JSON.stringify(products));
}

const Index = () => {
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategory]);

  const handleAddProduct = (product: Omit<Product, "id" | "clicks">) => {
    const newProducts = [...products, { ...product, id: crypto.randomUUID(), clicks: 0 }];
    setProducts(newProducts);
    saveProducts(newProducts);
  };

  const handleDeleteProduct = (id: string) => {
    const newProducts = products.filter((p) => p.id !== id);
    setProducts(newProducts);
    saveProducts(newProducts);
  };

  const handleClickTrack = (id: string) => {
    const newProducts = products.map((p) =>
      p.id === id ? { ...p, clicks: p.clicks + 1 } : p
    );
    setProducts(newProducts);
    saveProducts(newProducts);
  };

  const handleLogin = (code: string) => {
    if (code === ADMIN_CODE) {
      setIsAdmin(true);
      setShowLogin(false);
      setShowAdminPanel(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="pt-10 pb-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          <span className="text-gradient-primary">DL</span>
          <span className="text-foreground">STORE</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Os melhores produtos selecionados para você</p>
      </header>

      {/* Search */}
      <div className="max-w-xl mx-auto px-4 mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap justify-center gap-2 px-4 mb-10">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? "gradient-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground border border-border hover:border-primary/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              imageUrl={product.imageUrl}
              affiliateLink={product.affiliateLink}
              category={product.category}
              price={product.price}
              onClickTrack={() => handleClickTrack(product.id)}
            />
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <p className="text-center text-muted-foreground mt-16">Nenhum produto encontrado.</p>
        )}
      </main>

      {/* Admin FAB */}
      <button
        onClick={() => (isAdmin ? setShowAdminPanel(!showAdminPanel) : setShowLogin(true))}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-xl hover:opacity-90 transition-opacity z-40"
      >
        <Lock size={22} />
      </button>

      {/* Admin Login Dialog */}
      <AdminLoginDialog
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={handleLogin}
      />

      {/* Admin Panel */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        products={products}
        onAddProduct={handleAddProduct}
        onDeleteProduct={handleDeleteProduct}
        onLogout={handleLogout}
      />
    </div>
  );
};

export default Index;
