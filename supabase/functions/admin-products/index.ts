import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_HASH =
  "df4142c988f294e5274655671db7148f5d74dc8a8dc3d936074d57b35e51c0c2";

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { adminCode, action, ...payload } = body;

    if (!adminCode || typeof adminCode !== "string") {
      return json({ error: "Código de admin obrigatório" }, 401);
    }

    const hash = await hashCode(adminCode);
    if (hash !== ADMIN_HASH) {
      return json({ error: "Código de admin inválido" }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    switch (action) {
      case "insert": {
        const { data, error } = await supabase
          .from("products")
          .insert({
            name: payload.name,
            image_url: payload.image_url || "/placeholder.svg",
            affiliate_link: payload.affiliate_link,
            category: payload.category || "Eletrônicos e Informática",
            price: payload.price || "",
            rating: payload.rating || "",
          })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ success: true, data });
      }

      case "update": {
        if (!payload.id) return json({ error: "ID obrigatório" }, 400);
        const { error } = await supabase
          .from("products")
          .update({
            name: payload.name,
            image_url: payload.image_url,
            affiliate_link: payload.affiliate_link,
            category: payload.category,
            price: payload.price,
          })
          .eq("id", payload.id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "delete": {
        if (!payload.id) return json({ error: "ID obrigatório" }, 400);
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", payload.id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "increment_clicks": {
        if (!payload.id) return json({ error: "ID obrigatório" }, 400);
        const { error } = await supabase.rpc("increment_clicks" as any, {
          product_id: payload.id,
        });
        // Fallback: direct update if RPC doesn't exist
        if (error) {
          const { data: product } = await supabase
            .from("products")
            .select("clicks")
            .eq("id", payload.id)
            .single();
          if (product) {
            await supabase
              .from("products")
              .update({ clicks: (product.clicks || 0) + 1 })
              .eq("id", payload.id);
          }
        }
        return json({ success: true });
      }

      default:
        return json({ error: "Ação inválida" }, 400);
    }
  } catch (e) {
    console.error("Admin products error:", e);
    return json({ error: "Erro interno" }, 500);
  }
});
