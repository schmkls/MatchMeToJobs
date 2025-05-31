export interface CompanyScoreRequestQuery {
  userMission: string;
  userProduct: string;
  companyMission: string;
  companyProduct: string;
}

export interface CompanyScoreResponse {
  llmMissionScore: number | null;
  llmProductScore: number | null;
  ceMissionScore: number | null;
  ceProductScore: number | null;
}
