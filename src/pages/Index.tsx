import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Lock } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import AdminPanel from "@/components/AdminPanel";
import AdminLoginDialog from "@/components/AdminLoginDialog";
import ContactSection from "@/components/ContactSection";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  price: string;
  rating: string;
  clicks: number;
}

const ADMIN_HASH = "df4142c988f294e5274655671db7148f5d74dc8a8dc3d936074d57b35e51c0c2";

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

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setProducts(
        data.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.image_url,
          affiliateLink: p.affiliate_link,
          category: p.category,
          price: p.price,
          rating: (p as any).rating || "",
          clicks: p.clicks,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    // Realtime: keep products in sync across all devices
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => fetchProducts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategory]);

  const handleAddProduct = async (product: Omit<Product, "id" | "clicks">) => {
    // Optimistic: add immediately to UI
    const tempId = crypto.randomUUID();
    const optimistic: Product = { ...product, id: tempId, clicks: 0 };
    setProducts((prev) => [optimistic, ...prev]);

    const { error } = await supabase.from("products").insert({
      name: product.name,
      image_url: product.imageUrl,
      affiliate_link: product.affiliateLink,
      category: product.category,
      price: product.price,
    });
    // Refresh to get real ID, or rollback on error
    if (error) {
      setProducts((prev) => prev.filter((p) => p.id !== tempId));
    } else {
      fetchProducts();
    }
  };

  const handleEditProduct = async (id: string, updated: Omit<Product, "id" | "clicks">) => {
    const { error } = await supabase
      .from("products")
      .update({
        name: updated.name,
        image_url: updated.imageUrl,
        affiliate_link: updated.affiliateLink,
        category: updated.category,
        price: updated.price,
      })
      .eq("id", id);
    if (!error) fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) fetchProducts();
  };

  const handleClickTrack = async (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    await supabase
      .from("products")
      .update({ clicks: product.clicks + 1 })
      .eq("id", id);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, clicks: p.clicks + 1 } : p))
    );
  };

  const handleLogin = async (code: string) => {
    const hash = await hashCode(code);
    if (hash === ADMIN_HASH) {
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
      <header className="pt-10 pb-6 text-center">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          <span className="text-gradient-primary">DL</span>
          <span className="text-foreground">STORE</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Os melhores produtos selecionados para você</p>
      </header>

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

      <button
        onClick={() => (isAdmin ? setShowAdminPanel(!showAdminPanel) : setShowLogin(true))}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-xl hover:opacity-90 transition-opacity z-[60]"
      >
        <Lock size={22} />
      </button>

      <AdminLoginDialog
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={handleLogin}
      />

      {showAdminPanel && (
        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          products={products}
          onAddProduct={handleAddProduct}
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};

export default Index;
