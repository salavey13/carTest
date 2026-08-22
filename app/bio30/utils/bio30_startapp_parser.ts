export interface Bio30StartAppParams {
  isBio30: boolean;
  productId?: string;
  referrerId?: string;
  targetPath?: string;
  isReferral: boolean;
}

/**
 * Parse BIO30 startapp parameters for referral and product routing
 * 
 * Expected formats:
 * - "bio30_<product-id>_ref_<referrer_id>" - Product with referral
 * - "bio30_ref_<referrer_id>" - Just referral, go to main page
 * - "bio30_<product-id>" - Just product
 * - "ref_<referrer_id>" - Legacy referral format
 */
export function parseBio30StartApp(startParam: string | null): Bio30StartAppParams {
  if (!startParam) {
    return {
      isBio30: false,
      isReferral: false,
    };
  }

  const parts = startParam.split('_');
  
  // Check if this is a BIO30 related startapp parameter
  const isBio30 = parts[0] === 'bio30' || startParam.startsWith('ref_');
  
  if (!isBio30) {
    return {
      isBio30: false,
      isReferral: false,
    };
  }

  let productId: string | undefined;
  let referrerId: string | undefined;
  let targetPath: string | undefined;
  let isReferral = false;

  if (parts[0] === 'bio30') {
    // New BIO30 format: bio30_<product-id>_ref_<referrer_id>
    let i = 1;
    
    // Check for product ID (next part unless it's "ref")
    if (i < parts.length && parts[i] !== 'ref') {
      productId = parts[i];
      i++;
    }
    
    // Check for referral
    if (i < parts.length && parts[i] === 'ref' && i + 1 < parts.length) {
      referrerId = parts[i + 1];
      isReferral = true;
      i += 2;
    }
    
    // Build target path
    if (productId) {
      const productPaths: Record<string, string> = {
        'cordyceps': '/bio30/categories/cordyceps-sinensis',
        'spirulina': '/bio30/categories/spirulina-chlorella',
        'lion-s-mane': '/bio30/categories/lion-s-mane',
        'magnesium': '/bio30/categories/magnesium-pyridoxine',
        'lions-mane': '/bio30/categories/lion-s-mane',
        'cordyceps-sinensis': '/bio30/categories/cordyceps-sinensis',
        'spirulina-chlorella': '/bio30/categories/spirulina-chlorella',
        'magnesium-pyridoxine': '/bio30/categories/magnesium-pyridoxine'
      };
      targetPath = productPaths[productId] || `/bio30/categories/${productId}`;
    } else {
      targetPath = '/bio30';
    }
  } else if (startParam.startsWith('ref_')) {
    // Legacy format: ref_<referrer_id>
    referrerId = parts[1];
    isReferral = true;
    targetPath = '/bio30';
  }

  return {
    isBio30: true,
    productId,
    referrerId,
    targetPath,
    isReferral,
  };
}

/**
 * Generate BIO30 referral links for sharing
 */
export function generateBio30ReferralLink(referralCode: string, productId?: string): string {
  if (productId) {
    return `https://t.me/oneBikePlsBot/vip?startapp=bio30_${productId}_ref_${referralCode}`;
  } else {
    return `https://t.me/oneBikePlsBot/vip?startapp=bio30_ref_${referralCode}`;
  }
}

/**
 * Get product ID from BIO30 URL path
 */
export function getProductIdFromPath(pathname: string): string | undefined {
  const pathParts = pathname.split('/');
  const categoriesIndex = pathParts.indexOf('categories');
  
  if (categoriesIndex !== -1 && categoriesIndex + 1 < pathParts.length) {
    return pathParts[categoriesIndex + 1];
  }
  
  return undefined;
}

/**
 * Map product IDs to friendly names for startapp parameters
 */
export const PRODUCT_ID_MAPPING: Record<string, string> = {
  'cordyceps-sinensis': 'cordyceps',
  'spirulina-chlorella': 'spirulina',
  'lion-s-mane': 'lions-mane',
  'magnesium-pyridoxine': 'magnesium'
};

/**
 * Get the short product ID for startapp parameters
 */
export function getShortProductId(productId: string): string {
  return PRODUCT_ID_MAPPING[productId] || productId;
}