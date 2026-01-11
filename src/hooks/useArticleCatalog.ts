import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ArticleCatalogItem {
  id: string;
  user_id: string;
  article: string;
  name: string | null;
  first_seen_at: string;
  is_visible: boolean;
  is_in_kill_list: boolean;
  kill_list_reason: string | null;
  kill_list_added_at: string | null;
  avg_sale_price: number | null;
  custom_prices: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ArticleCatalogUpdate {
  is_visible?: boolean;
  is_in_kill_list?: boolean;
  kill_list_reason?: string | null;
  name?: string | null;
  custom_prices?: Record<string, number>;
}

export function useArticleCatalog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading, error } = useQuery({
    queryKey: ["article-catalog", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("article_catalog")
        .select("*")
        .eq("user_id", user.id)
        .order("article", { ascending: true });

      if (error) throw error;
      return data as ArticleCatalogItem[];
    },
    enabled: !!user?.id,
  });

  const killListArticles = articles.filter(a => a.is_in_kill_list);
  const visibleArticles = articles.filter(a => a.is_visible && !a.is_in_kill_list);
  const hiddenArticles = articles.filter(a => !a.is_visible || a.is_in_kill_list);

  const updateArticle = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ArticleCatalogUpdate }) => {
      // If adding to kill list, also set kill_list_added_at
      const finalUpdates: ArticleCatalogUpdate & { kill_list_added_at?: string | null } = { ...updates };
      if (updates.is_in_kill_list === true) {
        finalUpdates.kill_list_added_at = new Date().toISOString();
      } else if (updates.is_in_kill_list === false) {
        finalUpdates.kill_list_added_at = null;
        finalUpdates.kill_list_reason = null;
      }

      const { error } = await supabase
        .from("article_catalog")
        .update(finalUpdates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-catalog"] });
    },
    onError: (error) => {
      console.error("Failed to update article:", error);
      toast.error("Не удалось обновить артикул");
    },
  });

  const updateMultipleArticles = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: ArticleCatalogUpdate }) => {
      const finalUpdates: ArticleCatalogUpdate & { kill_list_added_at?: string | null } = { ...updates };
      if (updates.is_in_kill_list === true) {
        finalUpdates.kill_list_added_at = new Date().toISOString();
      } else if (updates.is_in_kill_list === false) {
        finalUpdates.kill_list_added_at = null;
        finalUpdates.kill_list_reason = null;
      }

      const { error } = await supabase
        .from("article_catalog")
        .update(finalUpdates)
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-catalog"] });
      toast.success("Артикулы обновлены");
    },
    onError: (error) => {
      console.error("Failed to update articles:", error);
      toast.error("Не удалось обновить артикулы");
    },
  });

  const addCustomPriceField = useMutation({
    mutationFn: async ({ id, fieldName, value }: { id: string; fieldName: string; value: number }) => {
      const article = articles.find(a => a.id === id);
      if (!article) throw new Error("Article not found");

      const newCustomPrices = {
        ...(article.custom_prices || {}),
        [fieldName]: value,
      };

      const { error } = await supabase
        .from("article_catalog")
        .update({ custom_prices: newCustomPrices })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-catalog"] });
    },
    onError: (error) => {
      console.error("Failed to add custom price:", error);
      toast.error("Не удалось добавить цену");
    },
  });

  const removeCustomPriceField = useMutation({
    mutationFn: async ({ id, fieldName }: { id: string; fieldName: string }) => {
      const article = articles.find(a => a.id === id);
      if (!article) throw new Error("Article not found");

      const newCustomPrices = { ...(article.custom_prices || {}) };
      delete newCustomPrices[fieldName];

      const { error } = await supabase
        .from("article_catalog")
        .update({ custom_prices: newCustomPrices })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-catalog"] });
    },
    onError: (error) => {
      console.error("Failed to remove custom price:", error);
      toast.error("Не удалось удалить поле цены");
    },
  });

  // Sync articles from a specific run
  const syncFromRun = useMutation({
    mutationFn: async (runId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Get all articles from the run's analytics
      const { data: analytics, error: analyticsError } = await supabase
        .from("sales_analytics")
        .select("article, product_group, category, avg_price")
        .eq("run_id", runId);

      if (analyticsError) throw analyticsError;
      if (!analytics?.length) return 0;

      // Upsert into article_catalog
      const articlesToUpsert = analytics.map(a => ({
        user_id: user.id,
        article: a.article,
        name: a.product_group || a.category || null,
        avg_sale_price: a.avg_price,
      }));

      const { error: upsertError } = await supabase
        .from("article_catalog")
        .upsert(articlesToUpsert, { 
          onConflict: "user_id,article",
          ignoreDuplicates: false 
        });

      if (upsertError) throw upsertError;
      return analytics.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["article-catalog"] });
      toast.success(`Синхронизировано ${count} артикулов`);
    },
    onError: (error) => {
      console.error("Failed to sync articles:", error);
      toast.error("Не удалось синхронизировать артикулы");
    },
  });

  return {
    articles,
    killListArticles,
    visibleArticles,
    hiddenArticles,
    isLoading,
    error,
    updateArticle,
    updateMultipleArticles,
    addCustomPriceField,
    removeCustomPriceField,
    syncFromRun,
  };
}

// Helper to check if an article should be shown in reports
export function isArticleVisibleInReport(
  article: string,
  catalog: ArticleCatalogItem[]
): boolean {
  const catalogItem = catalog.find(c => c.article === article);
  if (!catalogItem) return true; // Not in catalog = visible by default
  return catalogItem.is_visible && !catalogItem.is_in_kill_list;
}
