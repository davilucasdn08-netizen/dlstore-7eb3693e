import { useState } from "react";
import { X, LogOut, Plus, Trash2, BarChart3, Pencil, Check, XCircle } from "lucide-react";

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  price: string;
  clicks: number;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddProduct: (product: Omit<Product, "id" | "clicks">) => void;
  onEditProduct: (id: string, product: Omit<Product, "id" | "clicks">) => void;
  onDeleteProduct: (id: string) => void;
  onLogout: () => void;
}

const CATEGORIES = [
  "Moda e Acessórios",
  "Eletrônicos e Informática",
  "Casa e Decoração",
  "Beleza e Cuidados Pessoais",
];

const inputClass = "w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

const AdminPanel = ({ isOpen, onClose, products, onAddProduct, onEditProduct, onDeleteProduct, onLogout }: AdminPanelProps) => {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editAffiliateLink, setEditAffiliateLink] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const handleSubmit = () => {
    if (!name || !imageUrl || !affiliateLink || !category) return;
    onAddProduct({ name, imageUrl, affiliateLink, category, price });
    setName("");
    setImageUrl("");
    setAffiliateLink("");
    setCategory("");
    setPrice("");
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
    if (!editingId || !editName || !editImageUrl || !editAffiliateLink || !editCategory) return;
    onEditProduct(editingId, {
      name: editName,
      imageUrl: editImageUrl,
      affiliateLink: editAffiliateLink,
      category: editCategory,
      price: editPrice,
    });
    setEditingId(null);
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-card border-l border-border z-50 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      } overflow-y-auto`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gradient-primary">Admin</h2>
          <div className="flex items-center gap-3">
            <button onClick={onLogout} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <input type="text" placeholder="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <input type="text" placeholder="URL da imagem" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} />
          <input type="text" placeholder="Link afiliado" value={affiliateLink} onChange={(e) => setAffiliateLink(e.target.value)} className={inputClass} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} appearance-none`}>
            <option value="" disabled>Selecione a categoria</option>
            {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
          <input type="text" placeholder="Preço (ex: 99.90)" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          <button onClick={handleSubmit} className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <Plus size={18} /> Adicionar produto
          </button>
        </div>

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