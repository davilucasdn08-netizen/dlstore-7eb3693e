import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, Lock, User, ArrowRight, Zap, TrendingUp, ShieldCheck, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import AdminPanel from "@/components/AdminPanel";
import AdminLoginDialog from "@/components/AdminLoginDialog";
import ContactSection from "@/components/ContactSection";
import CategoryMenu from "@/components/CategoryMenu";
import { PRIMARY_CATEGORIES } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoginModal } from "@/components/LoginModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Hash para a senha antiga "Dlknunes01#"
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
  const [activeCategory, setActiveCategory] = useState("Início");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const showAdminPanelState = useState(false);
  const showAdminPanel = showAdminPanelState[0];
  const setShowAdminPanel = showAdminPanelState[1];
  const adminCodeRef = useRef<string>("");
  const secretClicksRef = useRef(0);
  const { user } = useAuth();
  const secretTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretLogoClick = () => {
    secretClicksRef.current += 1;
    if (secretClicksRef.current >= 5) {
      if (isAdmin) setShowAdminPanel(!showAdminPanel);
      else setShowLogin(true);
      secretClicksRef.current = 0;
    }
    if (secretTimeoutRef.current) clearTimeout(secretTimeoutRef.current);
    secretTimeoutRef.current = setTimeout(() => {
      secretClicksRef.current = 0;
    }, 2000);
  };

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
    let result = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = (activeCategory === "Todos" || activeCategory === "Início") ? true : p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
    
    // Limits the catalog size on Home Page to feel like a featured selection
    if (activeCategory === "Início" && search === "") {
      const bestPerCategory = new Map<string, Product>();
      const sortedByClicks = [...result].sort((a, b) => b.clicks - a.clicks);

      // 1. Get the absolute best product from up to 8 DIFFERENT categories
      for (const product of sortedByClicks) {
        if (!bestPerCategory.has(product.category)) {
          bestPerCategory.set(product.category, product);
        }
        if (bestPerCategory.size >= 8) break;
      }
      
      let curated = Array.from(bestPerCategory.values());
      
      // 2. If we don't have 8 distinct categories yet, backfill with the remaining most popular products
      if (curated.length < 8) {
         for (const product of sortedByClicks) {
            if (!curated.find(p => p.id === product.id)) {
               curated.push(product);
            }
            if (curated.length >= 8) break;
         }
      }
      result = curated;
    }
    
    return result;
  }, [products, search, activeCategory]);

  const isHome = activeCategory === "Início" && search === "";

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        {/* Top row: logo + right actions */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-3 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <h1 
              className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight cursor-pointer select-none" 
              translate="no"
              onClick={handleSecretLogoClick}
              title="DLSTORE"
            >
              <span className="text-gradient-primary">DL</span>
              <span className="text-foreground">STORE</span>
            </h1>
          </div>

          {/* Search bar: hidden on mobile (shown in row below), visible on sm+ */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (activeCategory === "Início" && e.target.value.trim() !== "") {
                   setActiveCategory("Todos");
                }
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CategoryMenu activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus:outline-none">
                  <User size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium leading-none text-foreground">Sua Conta</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="hover:bg-secondary cursor-pointer">
                    <Link to="/perfil" className="w-full">Meu Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                    onClick={() => supabase.auth.signOut()}
                  >
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <LoginModal>
                <button className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border focus:outline-none">
                  <User size={18} />
                </button>
              </LoginModal>
            )}
          </div>
        </div>

        {/* Mobile search bar - only visible on small screens */}
        <div className="sm:hidden px-3 pb-2">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (activeCategory === "Início" && e.target.value.trim() !== "") {
                   setActiveCategory("Todos");
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Quick-filter chips */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => {
              setActiveCategory("Início");
              setSearch("");
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
              activeCategory === "Início"
                ? "gradient-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground border border-border hover:border-primary/40"
            }`}
          >
            Início
          </button>
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

      {/* Landing Page Hero Section */}
      {isHome && (
        <section className="relative w-full overflow-hidden bg-background py-10 md:py-16 border-b border-border/50 flex flex-col items-center justify-center min-h-[60vh] md:min-h-[80vh]">
          {/* Abstract Premium Backgrounds */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl overflow-hidden pointer-events-none">
             <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
             <div className="absolute top-[20%] right-[-5%] w-[30%] h-[40%] rounded-full bg-blue-500/10 blur-[100px]" />
             <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 text-center z-10 flex flex-col items-center w-full">
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs sm:text-sm font-medium text-foreground mb-5 md:mb-8 animate-in slide-in-from-bottom-3 duration-500">
               <Zap className="text-primary fill-primary" size={14} />
               <span>A sua nova experiência de compras</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-[4rem] font-black tracking-tight text-foreground leading-[1.15] md:leading-[1.1] mb-5 animate-in slide-in-from-bottom-4 duration-700 px-2">
              Os melhores produtos <br className="hidden sm:block" />
              em um só lugar. <span className="text-gradient-primary">DLSTORE</span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl text-center mb-7 md:mb-10 animate-in slide-in-from-bottom-5 duration-1000 px-2">
              A curadoria mais inteligente da internet. Filtramos as maiores tendências globais para entregar as ofertas mais exclusivas, com autoridade e qualidade premium.
            </p>

            <div className="flex flex-col items-center animate-in slide-in-from-bottom-6 duration-1000 px-2 w-full sm:w-auto">
               <Link 
                 to="/sobre" 
                 className="group mb-8 flex items-center gap-2 px-6 py-2.5 rounded-full bg-card/40 backdrop-blur-md border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground hover:scale-105 transition-all duration-300 font-bold text-sm sm:text-base shadow-lg shadow-primary/5 hover:shadow-primary/20"
               >
                 Conheça a marca <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
               </Link>

               <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => {
                      setActiveCategory("Todos");
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex h-12 sm:h-14 items-center justify-center gap-2 px-6 sm:px-8 rounded-full gradient-primary text-primary-foreground font-bold text-base sm:text-lg hover:scale-105 transition-transform shadow-lg shadow-primary/25"
                  >
                    Explorar <ArrowRight size={20} />
                  </button>
                  {!user && (
                    <LoginModal>
                      <button 
                         className="flex h-12 sm:h-14 items-center justify-center gap-2 px-6 sm:px-8 rounded-full bg-secondary text-secondary-foreground font-bold text-base sm:text-lg hover:bg-secondary/80 border border-border transition-colors w-full sm:w-auto"
                      >
                        Fazer Login
                      </button>
                    </LoginModal>
                  )}
               </div>
            </div>

            {/* Features Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-4xl mt-10 md:mt-16 animate-in fade-in duration-1000 delay-500 px-2">
               <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:scale-105 transition-transform">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck size={18} /></div>
                  <span className="font-semibold text-xs sm:text-sm">Garantia Amazon</span>
               </div>
               <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:scale-105 transition-transform">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Zap size={18} /></div>
                  <span className="font-semibold text-xs sm:text-sm">Envio Rápido</span>
               </div>
               <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:scale-105 transition-transform">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><TrendingUp size={18} /></div>
                  <span className="font-semibold text-xs sm:text-sm">Curadoria Premium</span>
               </div>
               <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:scale-105 transition-transform">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Lock size={18} /></div>
                  <span className="font-semibold text-xs sm:text-sm">Compra Segura</span>
               </div>
            </div>

          </div>
        </section>
      )}

      {/* Active category indicator when not Início/Todos */}
      {(activeCategory !== "Todos" && activeCategory !== "Início") && (
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

      <main id="vitrine-start" className="max-w-6xl mx-auto px-3 sm:px-4 py-6 md:py-12 pb-24 scroll-mt-24">
        {isHome && (
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl md:text-3xl font-bold text-foreground">Seleção <span className="text-primary">Especial</span></h3>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
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

      {/* Floating WhatsApp Button - Mobile Friendly */}
      <a
        href="https://wa.me/5531971638543"
        target="_blank"
        rel="noopener noreferrer"
        className="fab-whatsapp"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle size={26} />
      </a>

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
