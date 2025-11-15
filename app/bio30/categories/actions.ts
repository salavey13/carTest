"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

export interface Bio30Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  category: string;
  purpose: string[];
  tags: string[]; // NEW: Added tags field
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
  tags?: string[]; // NEW: Added tags filter parameter
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
      query = query.eq("specs->>type", filters.category);
    }

    // Apply price range filter - cast to numeric
    if (filters?.minPrice !== undefined) {
      query = query.gte("specs->>price::numeric", filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte("specs->>price::numeric", filters.maxPrice);
    }

    // Apply purpose filter - use JSONB containment
    if (filters?.purpose && filters.purpose.length > 0) {
      // Build OR condition for multiple purposes
      const purposeConditions = filters.purpose.map(p => 
        `specs->>purpose.ilike.*${p}*`
      ).join(',');
      query = query.or(purposeConditions);
    }

    // NEW: Apply tags filter using hashtags field
    if (filters?.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(tag => 
        `specs->>hashtags.ilike.%${tag}%`
      ).join(',');
      query = query.or(tagConditions);
    }

    // Apply search filter across multiple fields
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      query = query.or([
        `specs->>model.ilike.%${searchTerm}%`,
        `specs->>purpose.ilike.%${searchTerm}%`,
        `description.ilike.%${searchTerm}%`
      ].join(','));
    }

    const { data, error } = await query
      .order('specs->price', { ascending: true })
      .limit(50);

    if (error) {
      logger.error("Error fetching BIO 3.0 products:", error);
      return { success: false, error: error.message };
    }

    // Transform data
    const products: Bio30Product[] = (data || []).map(car => {
      const specs = car.specs as Record<string, any> || {};
      const model = specs.model || '';
      const cleanTitle = model.replace(/(\d+)$/, '').trim();
      
      // Parse purposes (semicolon-separated)
      const purposeStr = specs.purpose || '';
      const purposes = purposeStr.split(';').map((p: string) => p.trim()).filter(Boolean);
      
      // NEW: Parse hashtags from specs (space-separated with #)
      const hashtagsStr = specs.hashtags || '';
      const tags = hashtagsStr
        .split(/\s+/)
        .map((t: string) => t.replace(/^#/, '').trim())
        .filter(Boolean);
      
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
        tags: tags, // NEW: Return parsed tags
        inStock: true,
        hasDiscount: hasDiscount
      };
    }).filter(product => {
      // Additional client-side filtering
      if (filters?.hasDiscount && !product.hasDiscount) return false;
      if (filters?.inStockOnly && !product.inStock) return false;
      return true;
    });

    logger.info(`Fetched ${products.length} BIO 3.0 products`);
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

export async function fetchBio30ProductById(id: string) {
  try {
    // First try exact ID match
    let query = supabaseAdmin
      .from("cars")
      .select("*")
      .eq("id", id)
      .eq("make", "BIO 3.0")
      .eq("is_test_result", false);

    let { data, error } = await query.single();

    // If not found, try searching by model name (for Cyrillic names)
    if (!data && error?.code === 'PGRST116') { // "JSON object requested, multiple (or no) rows returned"
      // Try to find by specs->model instead of id
      const { data: altData, error: altError } = await supabaseAdmin
        .from("cars")
        .select("*")
        .eq("make", "BIO 3.0")
        .eq("is_test_result", false)
        .ilike("specs->>model", decodeURIComponent(id).toLowerCase())
        .limit(1);

      if (altError) {
        logger.error("Alternative query error:", altError);
        return { success: false, error: altError.message };
      }

      data = altData ? altData[0] : null;
      error = altError;
    }

    if (error && error.code !== 'PGRST116') {
      logger.error("Error fetching product by ID:", error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Product not found" };
    }

    // Rest of transformation logic...
    const specs = data.specs as Record<string, any> || {};
    const model = specs.model || '';
    const cleanTitle = model.replace(/(\d+)$/, '').trim();
    
    const purposeStr = specs.purpose || '';
    const purposes = purposeStr.split(';').map((p: string) => p.trim()).filter(Boolean);
    
    const hashtagsStr = specs.hashtags || '';
    const tags = hashtagsStr
      .split(/\s+/)
      .map((t: string) => t.replace(/^#/, '').trim())
      .filter(Boolean);
    
    const currentPrice = parseFloat(specs.price || 0);
    const oldPrice = parseFloat(specs.old_price || 0);
    const hasDiscount = oldPrice > currentPrice;

    const product: Bio30Product = {
      id: data.id,
      title: cleanTitle,
      description: data.description || purposeStr || 'Пищевая добавка BIO 3.0',
      price: currentPrice,
      originalPrice: hasDiscount ? oldPrice : undefined,
      image: data.image_url || (specs.photos && specs.photos[0]) || "https://bio30.ru/front/static/uploads/products/default.webp",
      category: specs.type || 'Пищевая добавка',
      purpose: purposes,
      tags: tags,
      inStock: true,
      hasDiscount: hasDiscount
    };

    return { success: true, data: product };
  } catch (err) {
    logger.error("Failed to fetch product by ID:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Process cart checkout (placeholder for payment integration)
 */
export async function checkoutCart(userId: string): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    // Get user's cart
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from("user_settings")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logger.error("Error fetching cart for checkout:", fetchError);
      return { success: false, error: fetchError.message };
    }

    const cart = userData?.metadata?.cart || [];
    
    if (cart.length === 0) {
      return { success: false, error: "Cart is empty" };
    }

    // Calculate total
    const total = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // Create order record (you'll need to create this table)
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        items: cart,
        total_amount: total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      logger.error("Error creating order:", orderError);
      return { success: false, error: orderError.message };
    }

    // Clear cart
    await supabaseAdmin
      .from("user_settings")
      .update({
        metadata: {
          ...userData.metadata,
          cart: []
        }
      })
      .eq("user_id", userId);

    // Log purchase activity for referrals
    try {
      const { processReferralCommissions } = await import('../ref_actions');
      await processReferralCommissions(
        orderData.id,
        userId,
        total
      );
    } catch (refError) {
      logger.error("Referral processing error:", refError);
      // Continue even if referral fails
    }

    return { 
      success: true, 
      orderId: orderData.id 
    };
  } catch (err) {
    logger.error("Checkout error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Add product to user's cart in metadata
 */
export async function addToCart(userId: string, productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user settings
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from("user_settings")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logger.error("Error fetching user cart:", fetchError);
      return { success: false, error: fetchError.message };
    }

    // Get product details
    const result = await fetchBio30ProductById(productId);
    if (!result.success || !result.data) {
      return { success: false, error: "Product not found" };
    }

    const product = result.data;
    const currentMetadata = userData?.metadata || {};
    const cart = currentMetadata.cart || [];

    // Check if product already in cart
    const existingIndex = cart.findIndex((item: any) => item.productId === productId);
    
    if (existingIndex >= 0) {
      // Increment quantity
      cart[existingIndex].quantity += 1;
    } else {
      // Add new item
      cart.push({
        productId: product.id,
        name: product.title,
        price: product.price,
        image: product.image,
        quantity: 1,
        category: product.category
      });
    }

    // Update metadata
    const { error: updateError } = await supabaseAdmin
      .from("user_settings")
      .update({
        metadata: {
          ...currentMetadata,
          cart: cart
        }
      })
      .eq("user_id", userId);

    if (updateError) {
      logger.error("Error updating cart:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    logger.error("Failed to add to cart:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Remove product from user's cart
 */
export async function removeFromCart(userId: string, productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from("user_settings")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logger.error("Error fetching user cart:", fetchError);
      return { success: false, error: fetchError.message };
    }

    const currentMetadata = userData?.metadata || {};
    let cart = currentMetadata.cart || [];

    // Remove item
    cart = cart.filter((item: any) => item.productId !== productId);

    // Update metadata
    const { error: updateError } = await supabaseAdmin
      .from("user_settings")
      .update({
        metadata: {
          ...currentMetadata,
          cart: cart
        }
      })
      .eq("user_id", userId);

    if (updateError) {
      logger.error("Error removing from cart:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    logger.error("Failed to remove from cart:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function fetchFeaturedBio30Products(limit: number = 8) {
  try {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("make", "BIO 3.0")
      .eq("is_test_result", false)
      .limit(limit)
      .order('specs->price', { ascending: true });

    if (error) {
      logger.error("Error fetching featured products:", error);
      return { success: false, error: error.message };
    }

    const products: Bio30Product[] = (data || []).map(car => {
      const specs = car.specs as Record<string, any> || {};
      const model = specs.model || '';
      const cleanTitle = model.replace(/(\d+)$/, '').trim();
      
      const purposeStr = specs.purpose || '';
      const purposes = purposeStr.split(';').map((p: string) => p.trim()).filter(Boolean);
      
      const hashtagsStr = specs.hashtags || '';
      const tags = hashtagsStr
        .split(/\s+/)
        .map((t: string) => t.replace(/^#/, '').trim())
        .filter(Boolean);
      
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
        tags: tags,
        inStock: true,
        hasDiscount: hasDiscount
      };
    });

    return { success: true, data: products };
  } catch (err) {
    logger.error("Failed to fetch featured products:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}