export type TeamMember = {
  name: string;
  imageUrl: string;
};

export type SiteConfig = {
  branding: {
    brandName: string;
    primaryColor: string;
    logoUrl?: string;
    logoColor?: string;
  };

  home: {
    heroHeading: string;
    heroSubheading: string;
    ctaText: string;
    heroImageUrl?: string;
  };

  about: {
    heroTitle: string;
    description: string;
    heroImageUrl?: string;
    headingColor: string;
    team: TeamMember[];
  };

  products: {
    title: string;
    description: string;
    imageUrl?: string;
  }[];

  whyChooseUs: {
    title: string;
    description: string;
  }[];

  contact: {
    phone: string;
    whatsapp: string;
    address: string;
    workingHours: string;
  };

  howItWorks: {
    enabled: boolean;
    title: string;
    ctaText: string;
    steps: {
      title: string;
      description: string;
      iconUrl?: string; // uploaded image
    }[];
  };

  footer: {
    bgColor: string;
    text: string;
  };
};
