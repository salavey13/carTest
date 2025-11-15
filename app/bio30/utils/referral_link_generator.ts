import { generateBio30ReferralLink, getShortProductId } from "./bio30_startapp_parser";

/**
 * Generate various types of referral links for BIO30
 */
export class ReferralLinkGenerator {
  
  /**
   * Generate a basic referral link for the main BIO30 page
   */
  static generateMainReferralLink(referralCode: string): string {
    return generateBio30ReferralLink(referralCode);
  }
  
  /**
   * Generate a product-specific referral link
   */
  static generateProductReferralLink(referralCode: string, productId: string): string {
    const shortProductId = getShortProductId(productId);
    return generateBio30ReferralLink(referralCode, shortProductId);
  }
  
  /**
   * Generate social sharing links with referral codes
   */
  static generateSocialShareLinks(referralCode: string, productId?: string, message?: string) {
    const referralLink = productId 
      ? this.generateProductReferralLink(referralCode, productId)
      : this.generateMainReferralLink(referralCode);
    
    const shareMessage = message || `Присоединяйся к BIO30 и получи скидку! Мой реферальный код: ${referralCode}`;
    
    return {
      telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareMessage)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareMessage + ' ' + referralLink)}`,
      vk: `https://vk.com/share.php?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent(shareMessage)}`,
      direct: referralLink,
      message: shareMessage
    };
  }
  
  /**
   * Generate QR code data for referral links
   */
  static generateQRCodeData(referralCode: string, productId?: string): {
    url: string;
    qrValue: string;
    displayText: string;
  } {
    const url = productId 
      ? this.generateProductReferralLink(referralCode, productId)
      : this.generateMainReferralLink(referralCode);
    
    const displayText = productId 
      ? `BIO30 Product + Ref: ${referralCode}`
      : `BIO30 Referral: ${referralCode}`;
    
    return {
      url,
      qrValue: url,
      displayText
    };
  }
  
  /**
   * Generate deep link for mobile apps
   */
  static generateDeepLink(referralCode: string, productId?: string): string {
    const baseLink = productId 
      ? this.generateProductReferralLink(referralCode, productId)
      : this.generateMainReferralLink(referralCode);
    
    // For Telegram bot, we can use the direct bot link
    return baseLink;
  }
  
  /**
   * Generate email sharing link
   */
  static generateEmailShareLink(
    referralCode: string, 
    productId?: string,
    subject?: string,
    body?: string
  ): string {
    const socialLinks = this.generateSocialShareLinks(referralCode, productId);
    
    const emailSubject = subject || 'Приглашение в BIO30 - натуральные добавки для здоровья';
    const emailBody = body || 
      `Привет!\n\n` +
      `Хочу порекомендовать тебе BIO30 - качественные натуральные добавки для здоровья.\n` +
      `Перейди по ссылке и получи скидку: ${socialLinks.direct}\n\n` +
      `С уважением!`;
    
    return `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  }
}

/**
 * Product-specific link generators
 */
export class ProductReferralLinks {
  
  private referralCode: string;
  
  constructor(referralCode: string) {
    this.referralCode = referralCode;
  }
  
  lionsMane(): string {
    return ReferralLinkGenerator.generateProductReferralLink(this.referralCode, 'lion-s-mane');
  }
  
  cordyceps(): string {
    return ReferralLinkGenerator.generateProductReferralLink(this.referralCode, 'cordyceps-sinensis');
  }
  
  spirulina(): string {
    return ReferralLinkGenerator.generateProductReferralLink(this.referralCode, 'spirulina-chlorella');
  }
  
  magnesium(): string {
    return ReferralLinkGenerator.generateProductReferralLink(this.referralCode, 'magnesium-pyridoxine');
  }
  
  allProducts(): {
    lionsMane: string;
    cordyceps: string;
    spirulina: string;
    magnesium: string;
  } {
    return {
      lionsMane: this.lionsMane(),
      cordyceps: this.cordyceps(),
      spirulina: this.spirulina(),
      magnesium: this.magnesium()
    };
  }
}

/**
 * Analytics tracking for referral links
 */
export class ReferralAnalytics {
  
  /**
   * Track link generation for analytics
   */
  static trackLinkGeneration(params: {
    referralCode: string;
    productId?: string;
    platform?: string;
    userId: string;
  }): void {
    // Log to analytics service
    console.log('Referral link generated:', {
      referralCode: params.referralCode,
      productId: params.productId,
      platform: params.platform,
      userId: params.userId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Track link clicks (called when user clicks a referral link)
   */
  static trackLinkClick(params: {
    referralCode: string;
    productId?: string;
    source?: string;
    userId?: string;
  }): void {
    console.log('Referral link clicked:', {
      referralCode: params.referralCode,
      productId: params.productId,
      source: params.source,
      userId: params.userId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Example usage:
 * 
 * const linkGenerator = new ProductReferralLinks(userReferralCode);
 * const lionsManeLink = linkGenerator.lionsMane();
 * const allProductLinks = linkGenerator.allProducts();
 * 
 * const socialLinks = ReferralLinkGenerator.generateSocialShareLinks(
 *   userReferralCode, 
 *   'lion-s-mane',
 *   'Check out this amazing Lion\'s Mane supplement!'
 * );
 */