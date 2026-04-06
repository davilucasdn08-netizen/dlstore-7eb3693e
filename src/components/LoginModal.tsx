import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function LoginModal({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
          }
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
           if (error.message.includes("Invalid login credentials")) {
                throw new Error("Senha ou e-mail incorretos.");
           }
           if (error.message.includes("Email not confirmed")) {
                await supabase.auth.resend({ type: 'signup', email });
                throw new Error("Por favor, verifique seu e-mail.");
           }
           throw error;
        }
        toast.success("Login efetuado!");
        setIsOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Ocorreu um erro no login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">{isRegistering ? 'Criar uma Conta' : 'Acessar seu Perfil'}</DialogTitle>
          <DialogDescription>
            {isRegistering ? 'Insira seu email e escolha uma senha.' : 'Entre para ver seu histórico e favoritos.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleAuth} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Input 
              type="email" 
              placeholder="seu@gmail.com" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-background"
            />
            <Input 
              type="password" 
              placeholder="Sua senha secreta" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-background"
            />
          </div>
          
          <Button type="submit" className="w-full gradient-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            {isRegistering ? 'Cadastrar' : 'Entrar na Conta'}
          </Button>

          <div className="text-center mt-4">
             <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-primary hover:underline">
               {isRegistering ? 'Já tem uma conta? Fazer Login' : 'Não tem conta? Cadastre-se'}
             </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
