import {
  CompanyScoreRequestQuery,
  CompanyScoreResponse,
} from "types/companyScore.types";

export class CompanyScorerService {
  public async scoreCompany(
    queryParams: CompanyScoreRequestQuery
  ): Promise<CompanyScoreResponse> {
    // TODO: Implement actual scoring logic
    console.log("Scoring company with params:", queryParams);
    return {
      productScore: "1", // Placeholder
      missionScore: null, // Placeholder
    };
  }
}
