import { useState, useRef, useCallback } from "react";
import { X, LogOut, Plus, Trash2, BarChart3, Pencil, Check, XCircle, Loader2, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Product } from "@/pages/Index";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddProduct: (product: Omit<Product, "id" | "clicks">) => void;
  onEditProduct: (id: string, product: Omit<Product, "id" | "clicks">) => void;
  onDeleteProduct: (id: string) => void;
  onLogout: () => void;
}

import { CATEGORIES } from "@/lib/categories";

const inputClass = "w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

type BulkItem = {
  url: string;
  status: "pending" | "extracting" | "done" | "error";
  name?: string;
  imageUrl?: string;
  price?: string;
  category?: string;
  rating?: string;
};

const AdminPanel = ({ isOpen, onClose, products, onAddProduct, onEditProduct, onDeleteProduct, onLogout }: AdminPanelProps) => {
  const [bulkLinks, setBulkLinks] = useState("");
  const [bulkQueue, setBulkQueue] = useState<BulkItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Single product fields
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Edit fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editAffiliateLink, setEditAffiliateLink] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const extractSingle = async (url: string): Promise<Omit<BulkItem, "status"> | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("extract-product", {
        body: { url: url.trim() },
      });
      if (error || !data?.success || !data.data || !data.data.name) return null;
      const d = data.data;
      return {
        url: url.trim(),
        name: d.name || "",
        imageUrl: d.imageUrl || "",
        price: d.price || "",
        category: d.category || "Eletrônicos e Informática",
        rating: d.rating || "",
      };
    } catch {
      return null;
    }
  };

  const handleBulkProcess = useCallback(async () => {
    const urls = bulkLinks
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));

    if (urls.length === 0) {
      toast.error("Cole pelo menos um link válido.");
      return;
    }

    const queue: BulkItem[] = urls.map((url) => ({ url, status: "pending" as const }));
    setBulkQueue(queue);
    setIsBulkProcessing(true);
    setBulkLinks("");

    let added = 0;
    let failed = 0;

    // Process in parallel batches of 3
    for (let i = 0; i < queue.length; i += 3) {
      const batch = queue.slice(i, i + 3);
      const promises = batch.map(async (item, batchIdx) => {
        const idx = i + batchIdx;
        setBulkQueue((prev) => prev.map((q, qi) => qi === idx ? { ...q, status: "extracting" } : q));

        const result = await extractSingle(item.url);

        if (result && result.name) {
          onAddProduct({
            name: result.name,
            imageUrl: result.imageUrl || "/placeholder.svg",
            affiliateLink: item.url,
            category: result.category || "Eletrônicos e Informática",
            price: result.price || "",
            rating: result.rating || "",
          });
          setBulkQueue((prev) =>
            prev.map((q, qi) =>
              qi === idx ? { ...q, status: "done", ...result } : q
            )
          );
          added++;
        } else {
          setBulkQueue((prev) => prev.map((q, qi) => qi === idx ? { ...q, status: "error" } : q));
          failed++;
        }
      });
      await Promise.all(promises);
    }

    setIsBulkProcessing(false);
    toast.success(`${added} produto(s) adicionado(s)${failed > 0 ? `, ${failed} falha(s)` : ""}!`);
  }, [bulkLinks, onAddProduct]);

  // Single link paste handler
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    const urls = pasted.split(/[\n,]+/).filter((l) => l.trim().startsWith("http"));
    if (urls.length > 0) {
      e.preventDefault();
      setBulkLinks((prev) => (prev ? prev + "\n" : "") + urls.join("\n"));
    }
  };

  // Single quick add
  const handleSingleExtract = async () => {
    if (!affiliateLink.trim().startsWith("http")) return;
    setIsExtracting(true);
    const result = await extractSingle(affiliateLink);
    if (result) {
      setName(result.name || "");
      setImageUrl(result.imageUrl || "");
      setPrice(result.price || "");
      setCategory(result.category || "");
      toast.success("Dados extraídos!");
    } else {
      toast.info("Não foi possível extrair. Preencha manualmente.");
    }
    setIsExtracting(false);
  };

  const handleSingleSubmit = () => {
    if (!name || !affiliateLink) {
      toast.error("Preencha pelo menos o nome e o link.");
      return;
    }
    onAddProduct({
      name,
      imageUrl: imageUrl || "/placeholder.svg",
      affiliateLink,
      category: category || "Eletrônicos e Informática",
      price,
      rating: "",
    });
    setName(""); setImageUrl(""); setAffiliateLink(""); setCategory(""); setPrice("");
    toast.success("Produto adicionado!");
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditImageUrl(product.imageUrl);
    setEditAffiliateLink(product.affiliateLink);
    setEditCategory(product.category);
    setEditPrice(product.price);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editingId || !editName || !editAffiliateLink) return;
    onEditProduct(editingId, {
      name: editName,
      imageUrl: editImageUrl || "/placeholder.svg",
      affiliateLink: editAffiliateLink,
      category: editCategory || "Eletrônicos e Informática",
      price: editPrice,
      rating: "",
    });
    setEditingId(null);
    toast.success("Produto atualizado!");
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-card border-l border-border z-50 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
      } overflow-y-auto`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gradient-primary">Admin</h2>
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={16} /> Sair
          </button>
        </div>

        {/* Bulk Add */}
        <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-2">
            <Zap size={13} /> Cole vários links de uma vez
          </label>
          <textarea
            ref={textareaRef}
            placeholder={"Cole os links aqui (um por linha):\nhttps://produto1.com\nhttps://produto2.com\nhttps://produto3.com"}
            value={bulkLinks}
            onChange={(e) => setBulkLinks(e.target.value)}
            onPaste={handlePaste}
            rows={4}
            className={`${inputClass} text-sm py-2.5 resize-none`}
            disabled={isBulkProcessing}
          />
          <button
            onClick={handleBulkProcess}
            disabled={isBulkProcessing || !bulkLinks.trim()}
            className="w-full mt-2 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
          >
            {isBulkProcessing ? (
              <><Loader2 size={14} className="animate-spin" /> Processando...</>
            ) : (
              <><Zap size={14} /> Extrair e adicionar todos</>
            )}
          </button>
        </div>

        {/* Bulk Queue Status */}
        {bulkQueue.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Fila ({bulkQueue.filter((q) => q.status === "done").length}/{bulkQueue.length})
            </h3>
            {bulkQueue.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-md bg-secondary/50">
                {item.status === "pending" && <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />}
                {item.status === "extracting" && <Loader2 size={12} className="animate-spin text-primary" />}
                {item.status === "done" && <CheckCircle2 size={12} className="text-primary" />}
                {item.status === "error" && <AlertCircle size={12} className="text-destructive" />}
                <span className="truncate flex-1 text-foreground">
                  {item.name || item.url}
                </span>
                {item.category && (
                  <span className="text-muted-foreground text-[10px] shrink-0">{item.category.split(" ")[0]}</span>
                )}
              </div>
            ))}
            {!isBulkProcessing && (
              <button
                onClick={() => setBulkQueue([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                Limpar fila
              </button>
            )}
          </div>
        )}

        {/* Single add fallback */}
        <details className="mb-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors mb-2">
            Adicionar um produto manualmente
          </summary>
          <div className="space-y-3 p-3 rounded-lg border border-border bg-secondary/30">
            <input type="url" placeholder="Link do produto" value={affiliateLink} onChange={(e) => setAffiliateLink(e.target.value)} className={`${inputClass} text-sm`} />
            {affiliateLink.startsWith("http") && !name && (
              <button onClick={handleSingleExtract} disabled={isExtracting} className="w-full py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium flex items-center justify-center gap-1.5">
                {isExtracting ? <><Loader2 size={12} className="animate-spin" /> Extraindo...</> : "Extrair dados do link"}
              </button>
            )}
            <input type="text" placeholder="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} text-sm`} />
            <div className="flex gap-2">
              <input type="text" placeholder="Preço" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} text-sm w-1/3`} />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} text-sm appearance-none flex-1`}>
                <option value="" disabled>Categoria</option>
                {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <input type="text" placeholder="URL da imagem" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={`${inputClass} text-sm`} />
            <button onClick={handleSingleSubmit} className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              <Plus size={18} /> Adicionar produto
            </button>
          </div>
        </details>

        {/* Product list */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
            <BarChart3 size={14} /> Produtos ({products.length})
          </h3>
          <div className="space-y-2">
            {products.map((product) =>
              editingId === product.id ? (
                <div key={product.id} className="space-y-2 p-3 rounded-lg border border-primary/30 bg-secondary/50">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome" className={`${inputClass} text-sm py-2`} />
                  <input type="text" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="URL da imagem" className={`${inputClass} text-sm py-2`} />
                  <input type="text" value={editAffiliateLink} onChange={(e) => setEditAffiliateLink(e.target.value)} placeholder="Link afiliado" className={`${inputClass} text-sm py-2`} />
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className={`${inputClass} text-sm py-2 appearance-none`}>
                    {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                  <input type="text" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Preço" className={`${inputClass} text-sm py-2`} />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity">
                      <Check size={14} /> Salvar
                    </button>
                    <button onClick={cancelEdit} className="flex-1 py-2 rounded-lg bg-secondary border border-border text-muted-foreground text-sm font-semibold flex items-center justify-center gap-1 hover:text-foreground transition-colors">
                      <XCircle size={14} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div key={product.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate flex-1 text-foreground">
                    {product.name}{" "}
                    <span className="text-muted-foreground">({product.clicks} cliques)</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(product)} className="text-muted-foreground hover:text-primary transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDeleteProduct(product.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <button onClick={onClose} className="absolute bottom-6 right-6 w-12 h-12 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity">
        <X size={20} />
      </button>
    </div>
  );
};

export default AdminPanel;
