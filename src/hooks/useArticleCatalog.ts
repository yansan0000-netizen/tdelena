import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { KillListImportItem } from "@/lib/killListTypes";

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
        .order("article", { ascending: true })
        .limit(10000); // Override default 1000 limit

      if (error) throw error;
      return data as ArticleCatalogItem[];
    },
    enabled: !!user?.id,
  });

  const killListArticles = articles.filter(a => a.is_in_kill_list);
  const visibleArticles = articles.filter(a => a.is_visible && !a.is_in_kill_list);
  // Hidden articles = only those with is_visible=false (excluding kill list items)
  const hiddenArticles = articles.filter(a => !a.is_visible && !a.is_in_kill_list);

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

  // Bulk upsert articles to kill list from Excel import
  const bulkUpsertToKillList = async (
    items: KillListImportItem[]
  ): Promise<{ success: number; failed: number }> => {
    if (!user?.id) throw new Error("User not authenticated");

    let success = 0;
    let failed = 0;

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // First, fetch existing articles to merge custom_prices
      const articles = batch.map(item => item.article);
      const { data: existingArticles } = await supabase
        .from("article_catalog")
        .select("article, custom_prices")
        .eq("user_id", user.id)
        .in("article", articles);

      const existingMap = new Map(
        (existingArticles || []).map(a => [a.article, a.custom_prices as Record<string, number> || {}])
      );

      const upsertData = batch.map(item => {
        // Merge custom prices with existing ones
        const existingPrices = existingMap.get(item.article) || {};
        const mergedPrices = {
          ...existingPrices,
          ...(item.custom_prices || {}),
        };

        return {
          user_id: user.id,
          article: item.article,
          name: item.name || null,
          avg_sale_price: item.avg_sale_price || null,
          kill_list_reason: item.kill_list_reason || null,
          is_in_kill_list: true,
          kill_list_added_at: new Date().toISOString(),
          custom_prices: Object.keys(mergedPrices).length > 0 ? mergedPrices : null,
        };
      });

      const { error } = await supabase
        .from("article_catalog")
        .upsert(upsertData, {
          onConflict: "user_id,article",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Batch upsert error:", error);
        failed += batch.length;
      } else {
        success += batch.length;
      }
    }

    // Invalidate cache after all batches
    queryClient.invalidateQueries({ queryKey: ["article-catalog"] });

    if (success > 0) {
      toast.success(`Добавлено ${success} артикулов в kill-лист`);
    }
    if (failed > 0) {
      toast.error(`Не удалось добавить ${failed} артикулов`);
    }

    return { success, failed };
  };

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
    bulkUpsertToKillList,
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
