// ... existing imports ...

export interface Bio30Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  category: string;
  purpose: string[];
  tags: string[]; // Add this
  inStock: boolean;
  hasDiscount: boolean;
  originalPrice?: number;
}

export async function fetchBio30Products(filters?: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  purpose?: string[];
  tags?: string[]; // Add this
  inStockOnly?: boolean;
  hasDiscount?: boolean;
}) {
  try {
    let query = supabaseAdmin
      .from("cars")
      .select("*")
      .eq("make", "BIO 3.0")
      .eq("is_test_result", false);

    // ... existing filters ...

    // Apply tags filter (you'll need to adjust based on your schema)
    if (filters?.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(tag => 
        `specs->>tags.ilike.%${tag}%`
      ).join(',');
      query = query.or(tagConditions);
    }

    const { data, error } = await query
      .order('specs->price', { ascending: true })
      .limit(50);

    // ... rest of the function ...

    // Add tags parsing if you store them in specs
    const tags = specs.tags ? specs.tags.split(';').map((t: string) => t.trim()).filter(Boolean) : [];
    
    return {
      // ...
      tags,
      // ...
    };
  }
}