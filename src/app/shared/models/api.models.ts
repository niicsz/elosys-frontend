export interface Provenance {
  sourceName: string;
  agency: string;
  legalBasis: string | null;
  url: string;
  accessedAt: string;
  sha256: string;
  parserName: string;
  parserVersion: string;
}

export type SearchResult =
  | {
      kind: 'candidato';
      personId: number;
      canonicalName: string;
      cpf: string | null;
      cpfTrusted: boolean;
      candidacyCount: number;
      latestYear: number;
      latestOffice: string | null;
      latestPartyAbbr: string | null;
      latestState: string | null;
      latestResult: string | null;
      photoUrl: string | null;
    }
  | { kind: 'pessoa_fisica'; cpf: string; canonicalName: string };

export interface Meta {
  expenseYears: number[];
  assetYears: number[];
  expenseCategories: string[];
  sidebarCounts: SidebarCounts;
}

export interface SidebarCounts {
  circularDonations: number;
  supplierPartner: number;
  aiReview: number;
  discourse: number;
  disproportionateExpense: number;
}

export interface HomeStats {
  people: number;
  candidacies: number;
  campaignOrgs: number;
  socialMedia: number;
  donationsTotalCents: number;
  expensesTotalCents: number;
  years: string;
}

export interface TopSupplier {
  cnpj: string;
  name: string;
  totalCents: number;
  paymentCount: number;
  candidacyCount: number;
}

export interface HomeDoc {
  year: number | null;
  years: number[];
  stats: HomeStats;
  topSuppliers: TopSupplier[];
}

export interface Person {
  id: number;
  cpf: string | null;
  cpfTrusted: boolean;
  voterId: string | null;
  canonicalName: string | null;
}

export interface PersonHeader {
  person: Person;
  latestCandidacy: { year: number; office: string | null; partyAbbr: string | null; state: string | null } | null;
  candidacyCount: number;
  signalsCount: number;
  provenance: Provenance | null;
}

export interface Candidacy {
  id: number;
  year: number;
  electionType: string | null;
  round: number | null;
  office: string | null;
  candidateNumber: string | null;
  partyAbbr: string | null;
  partyName: string | null;
  state: string | null;
  municipality: string | null;
  result: string | null;
  ballotName: string | null;
  fullName: string | null;
  tseCandidacyId: string | null;
  provenance: Provenance;
}

export interface CampaignOrg {
  id: number;
  cnpj: string;
  year: number;
  office: string | null;
  partyAbbr: string | null;
  state: string | null;
  provenance: Provenance;
}

export interface SocialMediaLink {
  id: number;
  year: number;
  platform: string;
  url: string;
  state: string | null;
  provenance: Provenance;
}

export interface DeclaredAsset {
  id: number;
  year: number;
  assetType: string | null;
  description: string | null;
  valueCents: number;
  sourceUpdatedAt: string | null;
  provenance: Provenance;
}

export interface DeclaredAssetsYearSummary {
  year: number;
  totalCents: number;
  count: number;
}

export interface FinanceSummary {
  donationsCount: number;
  donationsTotalCents: number;
  expensesCount: number;
  expensesTotalCents: number;
  paymentsTotalCents: number;
  electoralFundTotalCents: number;
  electoralFundCount: number;
}

export interface ParliamentaryEarmark {
  id: number;
  earmarkCode: string;
  year: number;
  earmarkType: string | null;
  locality: string | null;
  state: string | null;
  municipality: string | null;
  functionName: string | null;
  actionName: string | null;
  committedCents: number | null;
  paidCents: number | null;
  provenance: Provenance;
}

export type AiVerdict = 'bizarro' | 'plausivel' | 'inconclusivo';

export interface AiReviewBrief {
  verdict: AiVerdict;
  confidence: string | null;
  explanation: string;
  model: string;
}

export interface CycleNode {
  cpfCnpj: string;
  label: string;
  type: 'person' | 'company';
  personId: number | null;
  photoUrl: string | null;
}

export interface Signal {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  role: string;
  rule: string;
  ruleVersion: string;
  expense: { id: number; description: string | null; amountCents: number; year: number; supplierName: string | null } | null;
  graphIds: string[] | null;
  cycleNodes: CycleNode[] | null;
  cycleEdgeAmounts: number[] | null;
  cycleAmountCents: number | null;
  cyclePathLength: number | null;
  aiReview: AiReviewBrief | null;
}

export interface NetworkNode {
  personId: number;
  label: string;
  amountCents: number;
  photoUrl: string | null;
}

export interface NetworkBranch {
  node: NetworkNode;
  children: NetworkNode[];
}

export interface DonationNetwork {
  donatedTo: NetworkBranch[];
  receivedFrom: NetworkBranch[];
}

export interface DiscourseSignal {
  postId: number;
  handle: string;
  personId: number | null;
  personName: string | null;
  party: string | null;
  state: string | null;
  kind: string;
  text: string;
  url: string | null;
  postedAt: string | null;
  matchedTerms: string[];
  severity: 'high' | 'medium' | 'low' | null;
  categories: string[];
  quote: string | null;
  explanation: string | null;
  replyToHandle: string | null;
}

export interface PoliticianDoc {
  year: number | null;
  years: number[];
  header: PersonHeader;
  photoUrl: string | null;
  photoProvenance: Provenance | null;
  finance: FinanceSummary;
  candidacies: Candidacy[];
  campaignOrgs: CampaignOrg[];
  socialMedia: SocialMediaLink[];
  assets: { declaredAssets: DeclaredAsset[]; declaredAssetsByYear: DeclaredAssetsYearSummary[] };
  earmarks: { earmarks: ParliamentaryEarmark[]; totalCommittedCents: number; totalPaidCents: number };
  signals: { signals: Signal[]; signalsCount: number };
  donationNetwork: DonationNetwork;
  discourseCount: number;
  discourse: DiscourseSignal[];
}

export interface CompanyRegistry {
  legalName: string | null;
  tradeName: string | null;
  openedAt: string | null;
  registryStatus: string | null;
  legalNature: string | null;
  primaryCnae: string | null;
  shareCapitalCents: number | null;
  size: string | null;
  city: string | null;
  state: string | null;
  provenance: Provenance;
}

export interface EntitySanction {
  id: number;
  registry: string;
  category: string | null;
  fineAmountCents: number | null;
  startDate: string | null;
  endDate: string | null;
  sanctioningAgency: string | null;
  agencySphere: string | null;
  provenance: Provenance;
}

export interface EntityProfile {
  cpfCnpj: string;
  isCompany: boolean;
  displayName: string | null;
  personId: number | null;
  companyKind: string | null;
  registry: CompanyRegistry | null;
  partners: { id: number; partnerName: string; role: string | null; entryDate: string | null }[];
  donationsGivenTotal: { count: number; totalCents: number };
  paymentsReceivedTotal: { count: number; totalCents: number };
  sanctions: EntitySanction[];
}

export interface CompanyEarmark {
  earmarkCode: string;
  earmarkYear: number | null;
  authorName: string | null;
  authorPersonId: number | null;
  amountCents: number;
  monthsCount: number;
  state: string | null;
  municipality: string | null;
}

export interface EntityDoc {
  redirectPersonId?: number;
  year: number | null;
  years: number[];
  profile: EntityProfile;
  companyEarmarks: { earmarks: CompanyEarmark[]; totalCents: number } | null;
}

export type FinanceSort = 'amount' | 'paid' | 'year' | 'date' | 'name';

export interface FinanceRow {
  id: number;
  year: number;
  date: string | null;
  amountCents: number;
  paidCents: number | null;
  counterpartyName: string | null;
  counterpartyDoc: string | null;
  counterpartyPersonId: number | null;
  counterpartyOpenedAt: string | null;
  detail: string | null;
  counterpartyIsPoliticianOwned: boolean;
  counterpartyPhotoUrl: string | null;
  provenance: Provenance;
}

export interface FinancePage {
  rows: FinanceRow[];
  total: number;
  pageSize: number;
}

export interface Page<T> {
  rows: T[];
  total: number;
  pageSize?: number;
}

export interface EarmarkPaymentRow {
  earmarkCode: string;
  year: number | null;
  authorName: string | null;
  authorPersonId: number | null;
  authorPhotoUrl: string | null;
  companyName: string | null;
  companyCnpj: string;
  amountCents: number;
}

export interface AssetsRankingRow {
  personId: number;
  name: string | null;
  assetCount: number;
  assetTotalCents: number;
  office: string | null;
  partyAbbr: string | null;
  state: string | null;
  year: number | null;
  photoUrl: string | null;
}

export interface AssetsGrowthRow {
  personId: number;
  name: string | null;
  office: string | null;
  partyAbbr: string | null;
  state: string | null;
  firstYear: number;
  lastYear: number;
  firstCents: number;
  lastCents: number;
  growthCents: number;
  growthPct: number | null;
  photoUrl: string | null;
}

export interface RankingDoc {
  type: 'bens' | 'crescimento';
  year: number | null;
  years: number[];
  pageSize: number;
  rows: Array<AssetsRankingRow & AssetsGrowthRow>;
  total: number;
}

export interface CircularSignal {
  id: number;
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  amountCents: number;
  pathLength: number;
  actors: { cpfCnpj: string; label: string; type: 'person' | 'company' }[];
  aiReview: AiReviewBrief | null;
}

export interface CircularDoc {
  summary: { total: number; bySeverity: Record<string, number>; ruleVersion: string | null; maxDepth: number | null; runAt: string | null };
  pageSize: number;
  rows: CircularSignal[];
}

export interface AiReviewRow {
  signalId: number;
  rule: string;
  ruleLabel: string;
  signalExplanation: string;
  signalAmountCents: number;
  verdict: AiVerdict;
  confidence: string | null;
  explanation: string;
  facts: string[];
  model: string;
  reviewedAt: string;
  graphIds: string[] | null;
}

export interface AiReviewDoc {
  summary: { total: number; byVerdict: Record<string, number>; model: string | null };
  total: number;
  pageSize: number;
  rows: AiReviewRow[];
}

export interface SupplierPartnerRow {
  personId: number;
  personName: string | null;
  companyCnpj: string;
  companyName: string | null;
  partnerRole: string | null;
  partnerSince: string | null;
  paymentsTotalCents: number;
  paymentsCount: number;
  payerCandidacies: number;
  paidBySelf: boolean;
}

export interface SupplierPartnerDoc {
  summary: { total: number; self: number; others: number; totalCents: number };
  total: number;
  pageSize: number;
  rows: SupplierPartnerRow[];
}

export interface DiscourseDoc {
  summary: { reviewed: number; total: number; accounts: number; bySeverity: Record<string, number>; byCategory: Record<string, number> };
  total: number;
  pageSize: number;
  rows: DiscourseSignal[];
}

export interface ExpenseCategoryRow {
  personId: number;
  name: string | null;
  photoUrl: string | null;
  office: string | null;
  state: string | null;
  categoryCents: number;
  categoryCount: number;
  revenueCents: number;
  sharePct: number | null;
  peerAvgSharePct: number | null;
  peerCount: number;
}

export interface ExpenseCategoryDetailRow {
  id: number;
  description: string;
  amountCents: number;
  year: number;
  provenance: Provenance;
}

export interface DisproportionateDoc {
  categories: string[];
  category: string | null;
  years: number[];
  year: number | null;
  signalsCount: number;
  pageSize: number;
  rows: ExpenseCategoryRow[];
  total: number;
}

export type GraphNodeKind = 'politician' | 'donor' | 'supplier' | 'sanctioned' | 'company' | 'person' | 'self';

export interface GraphNodeInfo {
  cpfCnpj: string;
  type: 'person' | 'company';
  kind: GraphNodeKind;
  label: string;
  sanctioned: boolean;
  registryStatus: string | null;
  personId: number | null;
  photoUrl: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: 'donation' | 'payment';
  amountCents: number;
  count: number;
}

export interface GraphSearchResult {
  type: 'person' | 'company';
  cpfCnpj: string;
  label: string;
  sublabel: string | null;
}
