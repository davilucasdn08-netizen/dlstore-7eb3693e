import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, Lock } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import AdminPanel from "@/components/AdminPanel";
import AdminLoginDialog from "@/components/AdminLoginDialog";
import ContactSection from "@/components/ContactSection";
import CategoryMenu from "@/components/CategoryMenu";
import { PRIMARY_CATEGORIES } from "@/lib/categories";
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

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const adminCodeRef = useRef<string>("");

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
    const channel = supabase
      .channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => fetchProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategory]);

  const adminAction = useCallback(async (action: string, payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-products", {
      body: { adminCode: adminCodeRef.current, action, ...payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const handleAddProduct = async (product: Omit<Product, "id" | "clicks">) => {
    const tempId = crypto.randomUUID();
    const optimistic: Product = { ...product, id: tempId, clicks: 0 };
    setProducts((prev) => [optimistic, ...prev]);
    try {
      await adminAction("insert", {
        name: product.name, image_url: product.imageUrl,
        affiliate_link: product.affiliateLink, category: product.category,
        price: product.price, rating: product.rating || "",
      });
      fetchProducts();
    } catch { setProducts((prev) => prev.filter((p) => p.id !== tempId)); }
  };

  const handleEditProduct = async (id: string, updated: Omit<Product, "id" | "clicks">) => {
    try {
      await adminAction("update", {
        id, name: updated.name, image_url: updated.imageUrl,
        affiliate_link: updated.affiliateLink, category: updated.category, price: updated.price,
      });
      fetchProducts();
    } catch { /* silent */ }
  };

  const handleDeleteProduct = async (id: string) => {
    try { await adminAction("delete", { id }); fetchProducts(); } catch { /* silent */ }
  };

  const handleClickTrack = async (id: string) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, clicks: p.clicks + 1 } : p)));
    await supabase.rpc("increment_product_clicks" as any, { product_id: id });
  };

  const handleLogin = async (code: string) => {
    const hash = await hashCode(code);
    if (hash === ADMIN_HASH) {
      adminCodeRef.current = code;
      setIsAdmin(true); setShowLogin(false); setShowAdminPanel(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    adminCodeRef.current = "";
    setIsAdmin(false); setShowAdminPanel(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight shrink-0" translate="no">
            <span className="text-gradient-primary">DL</span>
            <span className="text-foreground">STORE</span>
          </h1>

          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <CategoryMenu activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
        </div>

        {/* Quick-filter chips */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCategory("Todos")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
              activeCategory === "Todos"
                ? "gradient-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground border border-border hover:border-primary/40"
            }`}
          >
            Todos
          </button>
          {PRIMARY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                activeCategory === cat
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground border border-border hover:border-primary/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Active category indicator when not "Todos" */}
      {activeCategory !== "Todos" && (
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Categoria:</span>
          <span className="text-sm font-semibold text-foreground">{activeCategory}</span>
          <button
            onClick={() => setActiveCategory("Todos")}
            className="ml-1 text-xs text-primary hover:underline"
          >
            Limpar
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              imageUrl={product.imageUrl}
              affiliateLink={product.affiliateLink}
              category={product.category}
              price={product.price}
              rating={product.rating}
              onClickTrack={() => handleClickTrack(product.id)}
            />
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <p className="text-center text-muted-foreground mt-16">Nenhum produto encontrado.</p>
        )}
      </main>

      <ContactSection />

      <button
        onClick={() => (isAdmin ? setShowAdminPanel(!showAdminPanel) : setShowLogin(true))}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-xl hover:opacity-90 transition-opacity z-[60]"
      >
        <Lock size={22} />
      </button>

      <AdminLoginDialog isOpen={showLogin} onClose={() => setShowLogin(false)} onLogin={handleLogin} />

      {showAdminPanel && (
        <AdminPanel
          isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)}
          products={products} onAddProduct={handleAddProduct}
          onEditProduct={handleEditProduct} onDeleteProduct={handleDeleteProduct}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};

export default Index;
