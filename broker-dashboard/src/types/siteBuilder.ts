export type SiteConfig = {
  branding: {
    brandName: string;
    primaryColor: string;
    logoUrl?: string;
  };

  home: {
    heroHeading: string;
    heroSubheading: string;
    ctaText: string;
    heroImageUrl?: string; 
  };

  products: {
    title: string;
    description: string;
  }[];

  whyChooseUs: {
    title: string;
  }[];

  contact: {
    phone: string;
    whatsapp: string;
  };
};
