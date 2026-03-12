import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target_user_id } = await req.json();
    
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sourceUserId = "46630f79-af77-42f5-a738-c23f1789af8f";

    // Helper to escape SQL strings
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "number") return String(v);
      if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    };

    const replaceUserId = (val: string) => val === sourceUserId ? target_user_id : val;

    let sql = "-- TDElena Data Migration Export\n";
    sql += `-- Source user: ${sourceUserId}\n`;
    sql += `-- Target user: ${target_user_id}\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;

    // 1. user_settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", sourceUserId);
    
    if (settings?.length) {
      sql += "-- === USER SETTINGS ===\n";
      sql += "DELETE FROM public.user_settings WHERE user_id = '" + target_user_id + "';\n";
      for (const r of settings) {
        const cols = Object.keys(r);
        const vals = cols.map(c => c === "user_id" ? esc(target_user_id) : c === "id" ? `gen_random_uuid()` : esc(r[c]));
        sql += `INSERT INTO public.user_settings (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
      }
      sql += "\n";
    }

    // 2. recommendation_rules
    const { data: rules } = await supabase
      .from("recommendation_rules")
      .select("*")
      .eq("user_id", sourceUserId);
    
    if (rules?.length) {
      sql += "-- === RECOMMENDATION RULES ===\n";
      sql += "DELETE FROM public.recommendation_rules WHERE user_id = '" + target_user_id + "';\n";
      for (const r of rules) {
        const cols = Object.keys(r);
        const vals = cols.map(c => c === "user_id" ? esc(target_user_id) : c === "id" ? `gen_random_uuid()` : esc(r[c]));
        sql += `INSERT INTO public.recommendation_rules (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
      }
      sql += "\n";
    }

    // 3. article_catalog (batch)
    sql += "-- === ARTICLE CATALOG ===\n";
    sql += "DELETE FROM public.article_catalog WHERE user_id = '" + target_user_id + "';\n";
    let offset = 0;
    const batchSize = 500;
    while (true) {
      const { data: articles } = await supabase
        .from("article_catalog")
        .select("*")
        .eq("user_id", sourceUserId)
        .range(offset, offset + batchSize - 1);
      
      if (!articles?.length) break;
      
      for (const r of articles) {
        const cols = Object.keys(r);
        const vals = cols.map(c => c === "user_id" ? esc(target_user_id) : c === "id" ? `gen_random_uuid()` : esc(r[c]));
        sql += `INSERT INTO public.article_catalog (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
      }
      offset += batchSize;
      if (articles.length < batchSize) break;
    }
    sql += "\n";

    // 4. unit_econ_inputs (batch)
    sql += "-- === UNIT ECONOMICS ===\n";
    sql += "DELETE FROM public.unit_econ_inputs WHERE user_id = '" + target_user_id + "';\n";
    offset = 0;
    while (true) {
      const { data: items } = await supabase
        .from("unit_econ_inputs")
        .select("*")
        .eq("user_id", sourceUserId)
        .range(offset, offset + batchSize - 1);
      
      if (!items?.length) break;
      
      for (const r of items) {
        const cols = Object.keys(r);
        const vals = cols.map(c => c === "user_id" ? esc(target_user_id) : c === "id" ? `gen_random_uuid()` : esc(r[c]));
        sql += `INSERT INTO public.unit_econ_inputs (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
      }
      offset += batchSize;
      if (items.length < batchSize) break;
    }
    sql += "\n";

    // 5. runs (keep original IDs for FK references)
    const { data: runs } = await supabase
      .from("runs")
      .select("*")
      .eq("user_id", sourceUserId);
    
    const runIdMap: Record<string, string> = {};
    if (runs?.length) {
      sql += "-- === RUNS ===\n";
      for (const r of runs) {
        const newRunId = crypto.randomUUID();
        runIdMap[r.id] = newRunId;
        const cols = Object.keys(r);
        const vals = cols.map(c => {
          if (c === "user_id") return esc(target_user_id);
          if (c === "id") return esc(newRunId);
          return esc(r[c]);
        });
        sql += `INSERT INTO public.runs (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
      }
      sql += "\n";
    }

    // 6. sales_data_raw (large - batch)
    sql += "-- === SALES DATA RAW ===\n";
    for (const [oldRunId, newRunId] of Object.entries(runIdMap)) {
      offset = 0;
      while (true) {
        const { data: rows } = await supabase
          .from("sales_data_raw")
          .select("*")
          .eq("run_id", oldRunId)
          .range(offset, offset + batchSize - 1);
        
        if (!rows?.length) break;
        
        for (const r of rows) {
          const cols = Object.keys(r);
          const vals = cols.map(c => {
            if (c === "run_id") return esc(newRunId);
            if (c === "id") return `gen_random_uuid()`;
            return esc(r[c]);
          });
          sql += `INSERT INTO public.sales_data_raw (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
        }
        offset += batchSize;
        if (rows.length < batchSize) break;
      }
    }
    sql += "\n";

    // 7. sales_analytics
    sql += "-- === SALES ANALYTICS ===\n";
    for (const [oldRunId, newRunId] of Object.entries(runIdMap)) {
      offset = 0;
      while (true) {
        const { data: rows } = await supabase
          .from("sales_analytics")
          .select("*")
          .eq("run_id", oldRunId)
          .range(offset, offset + batchSize - 1);
        
        if (!rows?.length) break;
        
        for (const r of rows) {
          const cols = Object.keys(r);
          const vals = cols.map(c => {
            if (c === "run_id") return esc(newRunId);
            if (c === "id") return `gen_random_uuid()`;
            return esc(r[c]);
          });
          sql += `INSERT INTO public.sales_analytics (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
        }
        offset += batchSize;
        if (rows.length < batchSize) break;
      }
    }
    sql += "\n";

    // 8. sales_data
    sql += "-- === SALES DATA ===\n";
    for (const [oldRunId, newRunId] of Object.entries(runIdMap)) {
      offset = 0;
      while (true) {
        const { data: rows } = await supabase
          .from("sales_data")
          .select("*")
          .eq("run_id", oldRunId)
          .range(offset, offset + batchSize - 1);
        
        if (!rows?.length) break;
        
        for (const r of rows) {
          const cols = Object.keys(r);
          const vals = cols.map(c => {
            if (c === "user_id") return esc(target_user_id);
            if (c === "run_id") return esc(newRunId);
            if (c === "id") return `gen_random_uuid()`;
            return esc(r[c]);
          });
          sql += `INSERT INTO public.sales_data (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
        }
        offset += batchSize;
        if (rows.length < batchSize) break;
      }
    }

    return new Response(sql, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=tdelena-migration.sql",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
