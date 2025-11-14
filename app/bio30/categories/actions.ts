"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type DbCar = Database["public"]["Tables"]["cars"]["Row"];

export interface Bio30Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  category: string;
  purpose: string[];
  inStock: boolean;
  hasDiscount: boolean;
  originalPrice?: number;
}

// Fetch BIO 3.0 products with server-side filtering
export async function fetchBio30Products(filters?: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  purpose?: string[];
  inStockOnly?: boolean;
  hasDiscount?: boolean;
}) {
  try {
    let query = supabaseAdmin
      .from("cars")
      .select("*")
      .eq("make", "BIO 3.0")
      .eq("is_test_result", false);

    // Apply category filter from specs.type if provided
    if (filters?.category && filters.category !== 'Все категории') {
      query = query.contains("specs", { type: filters.category });
    }

    // Apply price range filter
    if (filters?.minPrice !== undefined) {
      query = query.gte("specs->>price", filters.minPrice.toString());
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte("specs->>price", filters.maxPrice.toString());
    }

    // Apply purpose filter
    if (filters?.purpose && filters.purpose.length > 0) {
      // Check if any of the purposes match
      query = query.or(filters.purpose.map(p => `specs->purpose.ilike.%${p}%`).join(','));
    }

    // Apply search filter across multiple fields
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      query = query.or(`specs->>model.ilike.%${searchTerm}%,specs->>purpose.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query
      .order("specs->>price", { ascending: true })
      .limit(50);

    if (error) {
      logger.error("Error fetching BIO 3.0 products:", error);
      return { success: false, error: error.message };
    }

    // Transform data and apply client-side filters for complex logic
    const products: Bio30Product[] = (data || []).map(car => {
      const specs = car.specs as Record<string, any> || {};
      const model = specs.model || '';
      const cleanTitle = model.replace(/(\d+)$/, '').trim();
      
      // Parse purposes (semicolon-separated)
      const purposeStr = specs.purpose || '';
      const purposes = purposeStr.split(';').map((p: string) => p.trim()).filter(Boolean);
      
      // Calculate discount status
      const currentPrice = parseFloat(specs.price || 0);
      const oldPrice = parseFloat(specs.old_price || 0);
      const hasDiscount = oldPrice > currentPrice;

      return {
        id: car.id,
        title: cleanTitle,
        description: car.description || purposeStr || 'Пищевая добавка BIO 3.0',
        price: currentPrice,
        originalPrice: hasDiscount ? oldPrice : undefined,
        image: car.image_url || (specs.photos && specs.photos[0]) || "https://bio30.ru/front/static/uploads/products/default.webp",
        category: specs.type || 'Пищевая добавка',
        purpose: purposes,
        inStock: true, // Since quantity > 0 in your data
        hasDiscount: hasDiscount
      };
    }).filter(product => {
      // Additional client-side filtering
      if (filters?.hasDiscount && !product.hasDiscount) return false;
      if (filters?.inStockOnly && !product.inStock) return false;
      return true;
    });

    return { success: true, data: products };
  } catch (err) {
    logger.error("Failed to fetch BIO 3.0 products:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Get unique categories for filter dropdown
export async function getUniqueCategories() {
  try {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("specs->type")
      .eq("make", "BIO 3.0")
      .not("specs", "is", null);

    if (error) {
      logger.error("Error fetching categories:", error);
      return { success: false, error: error.message };
    }

    const types = new Set<string>();
    types.add('Все категории');
    
    (data || []).forEach(item => {
      const type = item?.specs?.type;
      if (type && typeof type === 'string') {
        types.add(type);
      }
    });

    return { success: true, data: Array.from(types) };
  } catch (err) {
    logger.error("Failed to fetch categories:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Get unique purposes/tags for checkbox filters
export async function getUniquePurposes() {
  try {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("specs->purpose")
      .eq("make", "BIO 3.0")
      .not("specs", "is", null);

    if (error) {
      logger.error("Error fetching purposes:", error);
      return { success: false, error: error.message };
    }

    const purposes = new Set<string>();
    
    (data || []).forEach(item => {
      const purposeStr = item?.specs?.purpose || '';
      const purposeArray = purposeStr.split(';').map((p: string) => p.trim()).filter(Boolean);
      purposeArray.forEach(p => purposes.add(p));
    });

    return { success: true, data: Array.from(purposes) };
  } catch (err) {
    logger.error("Failed to fetch purposes:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}