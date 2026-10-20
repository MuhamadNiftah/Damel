export type RoleCode =
  | "MAKER_ANALYST"
  | "CHECKER_SUPERVISOR"
  | "APPROVER_HEAD"
  | "AUDITOR"
  | "ADMIN";

export type SourceCode = "DTTOT" | "DPPSPM" | "PEP" | "UN_SANCTION";
export type EntityType = "INDIVIDUAL" | "CORPORATE";
export type AliasType = "AKA" | "FKA" | "SPELLING_VARIANT";
export type DocumentType = "PASSPORT" | "NIK" | "TAX_ID" | "NATIONAL_ID";
export type BatchStatus = "PENDING" | "PARSING" | "PROCESSED" | "FAILED";
export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type MatchSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type CaseStatus = "OPEN" | "IN_ANALYSIS" | "PENDING_APPROVAL" | "CLOSED";
export type AnalystRecommendation =
  | "DISMISS_FALSE_POSITIVE"
  | "CONFIRM_HIT"
  | "ESCALATE_EDD";
export type NoteType =
  | "INTERNAL_ANALYSIS"
  | "VERIFICATION_CALL"
  | "BRANCH_REPLY";
export type EvidenceType =
  | "KTP_SCAN"
  | "PASSPORT_SCAN"
  | "KK_SCAN"
  | "UTILITY_BILL";
export type ApprovalStep =
  | "CHECKER_REVIEW"
  | "APPROVER_SIGN_OFF"
  | "COMPLETED"
  | "REJECTED";
export type FinalVerdict =
  | "CONFIRMED_TERRORIST_HIT"
  | "FALSE_POSITIVE_CLEAR"
  | null;
export type FreezeStatus = "ACTIVE_FROZEN" | "LIFTED";
export type ReportType = "LTKM_PPATK" | "SIPESAT_PEMBLOKIRAN" | "BERKALA_OJK";
export type ReportStatus = "DRAFT" | "READY_TO_SEND" | "SUBMITTED";

export type CustomerRiskRating = "LOW" | "MEDIUM" | "HIGH";
export type CustomerProfileStatus = "ACTIVE" | "DORMANT" | "CLOSED";
export type EmploymentStatus =
  | "PERMANENT"
  | "CONTRACT"
  | "SELF_EMPLOYED"
  | "RETIRED";

export interface CustomerEmployment {
  id: string;
  company_name: string;
  position: string;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
}

export interface CustomerTransaction {
  id: string;
  transaction_date: string;
  transaction_type:
    | "BUY"
    | "SELL"
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "TRANSFER";
  amount: number;
  channel: "RDN" | "TELLER" | "MOBILE" | "ONLINE";
  counterparty: string;
  status: "COMPLETED" | "PENDING" | "REVERSED";
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role_code: RoleCode;
  branch_code: string;
  is_active: boolean;
  avatar_color: string;
  created_at?: string;
  last_login_at?: string;
}

export interface WatchlistSource {
  id: string;
  source_code: SourceCode;
  version_label: string;
  published_by: string;
  effective_date: string;
  expiry_date: string | null;
  excel_file_name: string;
  uploaded_at: string;
  uploaded_by_user_id: string;
  is_current: boolean;
  notes: string;
}

export interface WatchlistEntity {
  id: string;
  source_id: string;
  entity_type: EntityType;
  primary_name: string;
  clean_primary_name: string;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  address_info: string | null;
  legal_reference: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WatchlistAlias {
  id: string;
  entity_id: string;
  alias_name: string;
  clean_alias_name: string;
  alias_type: AliasType;
}

export interface WatchlistDocument {
  id: string;
  entity_id: string;
  document_type: DocumentType;
  document_number: string;
  issuing_country: string;
}

export interface WhitelistRecord {
  id: string;
  entity_id: string;
  customer_cif: string;
  reason: string;
  approved_by_user_id: string;
  whitelisted_at: string;
}

export interface BatchUpload {
  id: string;
  batch_number: string;
  original_filename: string;
  total_records: number;
  valid_records: number;
  error_records: number;
  upload_status: BatchStatus;
  uploaded_by_user_id: string;
  created_at: string;
  completed_at: string | null;
}

export interface StagedCustomer {
  id: string;
  batch_id: string;
  cif_number: string;
  account_number: string;
  raw_full_name: string;
  sanitized_full_name: string;
  national_id_number: string;
  passport_number: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  address: string;
  customer_type: EntityType;
  staged_at: string;
  occupation?: string;
  employer_name?: string;
  employment_status?: EmploymentStatus;
  employment_history?: CustomerEmployment[];
  transactions?: CustomerTransaction[];
  risk_rating?: CustomerRiskRating;
  profile_status?: CustomerProfileStatus;
  onboarded_at?: string;
  monthly_income?: number;
  source_of_fund?: string;
  branch_code?: string;
}

export interface UploadError {
  id: string;
  batch_id: string;
  row_number: number;
  column_name: string;
  error_reason: string;
  raw_payload: string;
}

export interface ScreeningJob {
  id: string;
  batch_id: string;
  job_status: JobStatus;
  total_evaluated: number;
  total_hits: number;
  min_threshold_used: number;
  started_at: string | null;
  finished_at: string | null;
  triggered_by_user_id: string;
}

export interface ScreeningMatch {
  id: string;
  job_id: string;
  staged_customer_id: string;
  watchlist_entity_id: string;
  total_confidence_score: number;
  match_severity: MatchSeverity;
  is_exact_identity_match: boolean;
  is_whitelisted: boolean;
  matched_at: string;
}

export interface MatchScoreBreakdown {
  id: string;
  screening_match_id: string;
  name_similarity_score: number;
  dob_match_score: number;
  pob_match_score: number;
  nationality_match_score: number;
  matched_on_alias: string | null;
  algorithm_telemetry: Record<string, unknown>;
}

export interface InvestigationCase {
  id: string;
  case_number: string;
  screening_match_id: string;
  case_status: CaseStatus;
  analyst_recommendation: AnalystRecommendation | null;
  assigned_analyst_id: string;
  opened_at: string;
  closed_at: string | null;
  priority: "NORMAL" | "HIGH";
}

export interface CaseNote {
  id: string;
  case_id: string;
  author_user_id: string;
  note_content: string;
  note_type: NoteType;
  created_at: string;
}

export interface CaseEvidenceFile {
  id: string;
  case_id: string;
  file_name: string;
  file_type: EvidenceType;
  storage_path: string;
  file_size_bytes: number;
  uploaded_at: string;
}

export interface ApprovalRequest {
  id: string;
  case_id: string;
  maker_user_id: string;
  checker_user_id: string;
  approver_user_id: string;
  current_step: ApprovalStep;
  final_verdict: FinalVerdict;
  decision_reason: string;
  submitted_at: string;
  decided_at: string | null;
}

export interface AccountFreezeOrder {
  id: string;
  case_id: string;
  cif_number: string;
  account_number: string;
  legal_warrant_number: string;
  total_balance_frozen: number;
  freeze_status: FreezeStatus;
  frozen_at: string;
  lifted_at: string | null;
  freeze_reason: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action_name: string;
  module_name: string;
  ip_address: string;
  user_agent: string;
  state_before: Record<string, unknown> | null;
  state_after: Record<string, unknown> | null;
  timestamp: string;
  description: string;
}

export interface RegulatoryReport {
  id: string;
  case_id: string;
  report_type: ReportType;
  reference_number: string;
  xml_payload_content: string;
  submission_status: ReportStatus;
  generated_at: string;
  submitted_at: string | null;
  reported_by_user_id: string;
}

export interface DatabaseSchema {
  version: number;
  users: User[];
  watchlist_sources: WatchlistSource[];
  watchlist_entities: WatchlistEntity[];
  watchlist_aliases: WatchlistAlias[];
  watchlist_documents: WatchlistDocument[];
  whitelist_records: WhitelistRecord[];
  batch_uploads: BatchUpload[];
  staged_customers: StagedCustomer[];
  upload_errors: UploadError[];
  screening_jobs: ScreeningJob[];
  screening_matches: ScreeningMatch[];
  match_score_breakdowns: MatchScoreBreakdown[];
  investigation_cases: InvestigationCase[];
  case_notes: CaseNote[];
  case_evidence_files: CaseEvidenceFile[];
  approval_requests: ApprovalRequest[];
  account_freeze_orders: AccountFreezeOrder[];
  audit_logs: AuditLog[];
  regulatory_reports: RegulatoryReport[];
}

export interface MatchBreakdownView {
  name_similarity_score: number;
  dob_match_score: number;
  pob_match_score: number;
  nationality_match_score: number;
  matched_on_alias: string | null;
  algorithm_telemetry: Record<string, unknown>;
}

export interface MatchListItem {
  id: string;
  score: number;
  severity: MatchSeverity;
  is_exact_identity_match: boolean;
  is_whitelisted: boolean;
  matched_at: string;
  customer: {
    id: string;
    cif_number: string;
    account_number_masked: string;
    full_name: string;
    national_id_masked: string;
    date_of_birth: string;
    place_of_birth: string;
    nationality: string;
    customer_type: EntityType;
  };
  entity: {
    id: string;
    primary_name: string;
    entity_type: EntityType;
    nationality: string | null;
    date_of_birth: string | null;
    place_of_birth: string | null;
    legal_reference: string | null;
  };
  source: {
    code: SourceCode;
    version_label: string;
    published_by: string;
  };
  case: {
    id: string;
    case_number: string;
    status: CaseStatus;
    recommendation: AnalystRecommendation | null;
    has_approval: boolean;
    approval_step: ApprovalStep | null;
  } | null;
}

export interface MatchDetail extends MatchListItem {
  breakdown: MatchBreakdownView;
  customer_full: {
    national_id_number: string;
    passport_number: string;
    address: string;
  };
  aliases: string[];
  documents: WatchlistDocument[];
  case_detail: {
    id: string;
    case_number: string;
    status: CaseStatus;
    recommendation: AnalystRecommendation | null;
    assigned_analyst_id: string;
    opened_at: string;
    closed_at: string | null;
    priority: "NORMAL" | "HIGH";
    notes: Array<CaseNote & { author_name: string }>;
    evidence: CaseEvidenceFile[];
    approval: (ApprovalRequest & {
      maker_name: string;
      checker_name: string;
      approver_name: string;
    }) | null;
    freeze: AccountFreezeOrder | null;
    reports: RegulatoryReport[];
  } | null;
}

export interface CaseListItem {
  id: string;
  case_number: string;
  status: CaseStatus;
  recommendation: AnalystRecommendation | null;
  opened_at: string;
  closed_at: string | null;
  priority: "NORMAL" | "HIGH";
  customer_name: string;
  customer_cif: string;
  entity_name: string;
  source_code: SourceCode;
  score: number;
  severity: MatchSeverity;
  assigned_analyst_name: string;
  note_count: number;
  evidence_count: number;
  approval_step: ApprovalStep | null;
  final_verdict: FinalVerdict;
  freeze_status: FreezeStatus | null;
  report_count: number;
  match_id: string;
}

export interface ApprovalListItem {
  id: string;
  case_id: string;
  case_number: string;
  customer_name: string;
  entity_name: string;
  score: number;
  severity: MatchSeverity;
  current_step: ApprovalStep;
  final_verdict: FinalVerdict;
  submitted_at: string;
  maker_user_id: string;
  checker_user_id: string;
  approver_user_id: string;
  maker_name: string;
  checker_name: string;
  approver_name: string;
  recommendation: AnalystRecommendation | null;
  decision_reason: string;
}

export interface WatchlistSourceView extends WatchlistSource {
  entity_count: number;
  alias_count: number;
  document_count: number;
  whitelist_count: number;
}

export interface WatchlistEntityView {
  id: string;
  entity_type: EntityType;
  primary_name: string;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  address_info: string | null;
  legal_reference: string | null;
  is_active: boolean;
  created_at: string;
  source_code: SourceCode;
  source_version: string;
  aliases: string[];
  documents: Array<{ type: DocumentType; number: string; country: string }>;
  whitelist_count: number;
}

export interface BatchListItem extends BatchUpload {
  uploader_name: string;
  hits: number;
  job_status: JobStatus | null;
  job_id: string | null;
}

export interface AuditLogView extends AuditLog {
  user_name: string;
  user_role: RoleCode;
}

export interface ReportListItem extends RegulatoryReport {
  case_number: string;
  customer_name: string;
  entity_name: string;
  score: number;
  generated_by_name: string;
}

/* ----------------------------- Customer module ---------------------------- */

export interface CustomerQualityComponent {
  key: string;
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface CustomerQuality {
  score: number;
  grade: "A" | "B" | "C" | "D";
  label: string;
  color: string;
  components: CustomerQualityComponent[];
  strengths: string[];
  gaps: string[];
}

export interface CustomerMatchRef {
  match_id: string;
  entity_id: string;
  entity_name: string;
  source_code: SourceCode;
  source_version: string;
  score: number;
  severity: MatchSeverity;
  is_whitelisted: boolean;
  case_id: string | null;
  case_number: string | null;
  case_status: CaseStatus | null;
}

export interface CustomerListItem {
  id: string;
  cif_number: string;
  full_name: string;
  national_id_masked: string;
  account_number_masked: string;
  customer_type: EntityType;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  address: string;
  occupation: string;
  employer_name: string;
  employment_status: EmploymentStatus | null;
  risk_rating: CustomerRiskRating;
  profile_status: CustomerProfileStatus;
  branch_code: string;
  onboarded_at: string;
  monthly_income: number;
  quality: CustomerQuality;
  transaction_count: number;
  last_transaction_at: string | null;
  highest_severity: MatchSeverity | null;
  match_count: number;
  open_case_count: number;
}

export interface CustomerDetail extends CustomerListItem {
  national_id_number: string;
  passport_number: string;
  source_of_fund: string;
  batch_id: string;
  batch_number: string;
  employment_history: CustomerEmployment[];
  transactions: CustomerTransaction[];
  matches: CustomerMatchRef[];
  total_transaction_value: number;
  average_transaction_value: number;
}

export interface CustomerDatasetMetrics {
  total: number;
  active: number;
  dormant: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  withNik: number;
  averageQuality: number;
  totalTransactions: number;
}

export interface DashboardData {
  metrics: {
    totalScreened: number;
    clean: number;
    potential: number;
    suspect: number;
    totalHits: number;
    openCases: number;
    frozenAccounts: number;
    frozenBalance: number;
  };
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  trend: Array<{ date: string; screened: number; hits: number }>;
  recentMatches: MatchListItem[];
  sourceCoverage: Array<{
    code: SourceCode;
    label: string;
    entities: number;
    version: string;
    effective_date: string;
  }>;
  casePipeline: Array<{ stage: string; count: number; color: string }>;
  dataUniverse: {
    customers: number;
    activeCustomers: number;
    dttotEntities: number;
    apupptEntities: number;
    dttotSources: number;
    apupptSources: number;
    averageQuality: number;
    lastSyncAt: string | null;
  };
  lastUpdated: string;
}
