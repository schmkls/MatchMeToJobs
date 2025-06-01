export interface CompanyScoreRequestQuery {
  userMission: string | null;
  userProduct: string | null;
  companyMission: string | null;
  companyProduct: string | null;
}

export interface CompanyScoreResponse {
  llmMissionScore: number | null;
  llmProductScore: number | null;
  ceMissionScore: number | null;
  ceProductScore: number | null;
}
