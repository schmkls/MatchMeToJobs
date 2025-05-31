export interface CompanyScoreRequestQuery {
  mission: string;
  product: string;
}

export interface CompanyScoreResponse {
  productScore: string | null;
  missionScore: string | null;
}
