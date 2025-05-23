export interface JobSearchParams {
  revenueFrom?: number;
  revenueTo?: number;
  location?: string;
  profitFrom?: number;
  profitTo?: number;
  numEmployeesFrom?: number;
  numEmployeesTo?: number;
  sort?:
    | "profitAsc"
    | "registrationDateDesc"
    | "numEmployeesAsc"
    | "revenueAsc"
    | "revenueDesc";
  description: string;
}

export interface CompanyInfo {
  name: string;
  mission?: string;
  product?: string;
  website?: string;
  news?: NewsItem[];
  jobAds?: JobAd[];
}

export interface NewsItem {
  title: string;
  link: string;
  date?: string;
}

export interface JobAd {
  title: string;
  link: string;
  description?: string;
}

export interface RankedCompany extends CompanyInfo {
  score: number;
  reasoning?: string;
}
