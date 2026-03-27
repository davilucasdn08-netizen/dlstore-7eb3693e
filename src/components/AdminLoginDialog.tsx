import { useState } from "react";
import { Lock, X } from "lucide-react";

interface AdminLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (code: string) => Promise<boolean>;
}

const AdminLoginDialog = ({ isOpen, onClose, onLogin }: AdminLoginDialogProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const success = await onLogin(code);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
    setCode("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center">
            <Lock size={24} className="text-primary-foreground" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">Acesso Admin</h2>
            <p className="text-sm text-muted-foreground mt-1">Digite o código de acesso</p>
          </div>
          <input
            type="password"
            placeholder="Código de acesso"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={`w-full px-4 py-3 rounded-lg bg-secondary border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
              error ? "border-destructive" : "border-destructive/50"
            }`}
          />
          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginDialog;
