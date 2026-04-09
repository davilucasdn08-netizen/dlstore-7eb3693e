import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, Lock, UserPlus, LogIn, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type AuthView = "login" | "register" | "forgot";

function PasswordField({ value, onChange, placeholder, showPassword, onToggle }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background pl-10 pr-10"
        minLength={6}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function LoginModal({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<AuthView>("login");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setView("login");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("E-mail ou senha incorretos.");
        }
        if (error.message.includes("Email not confirmed")) {
          await supabase.auth.resend({ type: "signup", email: email.trim() });
          throw new Error("Confirme seu e-mail. Reenviamos o link de verificação.");
        }
        throw error;
      }
      toast.success("Bem-vindo(a) de volta!");
      setIsOpen(false);
      resetForm();
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
        },
      });
      if (error) throw error;
      toast.success("Conta criada! Verifique seu e-mail para ativar.");
      setView("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Link de redefinição enviado para seu e-mail!");
      setView("login");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar link.");
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px] border-border bg-card p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="gradient-primary px-6 pt-8 pb-6 text-center">
          <div className="w-14 h-14 mx-auto bg-background/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-3">
            {view === "login" && <LogIn size={28} className="text-primary-foreground" />}
            {view === "register" && <UserPlus size={28} className="text-primary-foreground" />}
            {view === "forgot" && <Mail size={28} className="text-primary-foreground" />}
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-foreground">
              {view === "login" && "Entrar na DLSTORE"}
              {view === "register" && "Criar sua Conta"}
              {view === "forgot" && "Recuperar Senha"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-primary-foreground/80 text-sm mt-1">
            {view === "login" && "Acesse seu histórico e favoritos"}
            {view === "register" && "Junte-se à comunidade DLSTORE"}
            {view === "forgot" && "Enviaremos um link para seu e-mail"}
          </p>
        </div>

        <div className="px-6 pb-6 pt-5">
          {/* LOGIN */}
          {view === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background pl-10"
                    autoComplete="email"
                  />
                </div>
                <PasswordField value={password} onChange={setPassword} placeholder="Sua senha" showPassword={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>

              <div className="text-right">
                <button type="button" onClick={() => setView("forgot")} className="text-xs text-primary hover:underline font-medium">
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" className="w-full gradient-primary font-semibold h-11" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <LogIn size={18} className="mr-2" />}
                Entrar
              </Button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou</span></div>
              </div>

              <Button type="button" variant="outline" className="w-full h-11 font-semibold" onClick={() => { setView("register"); setPassword(""); }}>
                <UserPlus size={18} className="mr-2" />
                Criar uma conta
              </Button>
            </form>
          )}

          {/* REGISTER */}
          {view === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background pl-10"
                    autoComplete="email"
                  />
                </div>
                <PasswordField value={password} onChange={setPassword} placeholder="Crie uma senha (mín. 6 caracteres)" showPassword={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                <PasswordField value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirme sua senha" showPassword={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>

              <Button type="submit" className="w-full gradient-primary font-semibold h-11" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <UserPlus size={18} className="mr-2" />}
                Criar Conta
              </Button>

              <button type="button" onClick={() => { setView("login"); setPassword(""); setConfirmPassword(""); }} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                <ArrowLeft size={14} />
                Já tenho uma conta
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {view === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background pl-10"
                  autoComplete="email"
                />
              </div>

              <Button type="submit" className="w-full gradient-primary font-semibold h-11" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Mail size={18} className="mr-2" />}
                Enviar Link de Recuperação
              </Button>

              <button type="button" onClick={() => setView("login")} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                <ArrowLeft size={14} />
                Voltar para o login
              </button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
