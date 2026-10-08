import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AiReviewDoc,
  CircularDoc,
  DiscourseDoc,
  DisproportionateDoc,
  EntityDoc,
  ExpenseCategoryDetailRow,
  FinancePage,
  GraphEdge,
  GraphNodeInfo,
  GraphSearchResult,
  HomeDoc,
  Meta,
  Page,
  EarmarkPaymentRow,
  PoliticianDoc,
  RankingDoc,
  SearchResult,
  SupplierPartnerDoc,
  TopSupplier,
} from '../shared/models/api.models';

type Params = Record<string, string | number | boolean | null | undefined>;

function params(p: Params): HttpParams {
  let hp = new HttpParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== null && v !== undefined && v !== '') hp = hp.set(k, String(v));
  }
  return hp;
}

@Injectable({ providedIn: 'root' })
export class ElosysApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  search(q: string): Observable<{ results: SearchResult[] }> {
    return this.http.get<{ results: SearchResult[] }>(`${this.base}/search`, { params: params({ q }) });
  }

  meta(): Observable<Meta> {
    return this.http.get<Meta>(`${this.base}/meta`);
  }

  home(ano?: number | null): Observable<HomeDoc> {
    return this.http.get<HomeDoc>(`${this.base}/home`, { params: params({ ano }) });
  }

  topSuppliers(year: string): Observable<{ suppliers: TopSupplier[] }> {
    return this.http.get<{ suppliers: TopSupplier[] }>(`${this.base}/top-suppliers`, { params: params({ year }) });
  }

  politician(id: number, ano?: number | null): Observable<PoliticianDoc> {
    return this.http.get<PoliticianDoc>(`${this.base}/politicos/${id}`, { params: params({ ano }) });
  }

  politicianCategoryExpenses(id: number, categoria?: string | null, ano?: number | null): Observable<{ rows: ExpenseCategoryDetailRow[] }> {
    return this.http.get<{ rows: ExpenseCategoryDetailRow[] }>(`${this.base}/politicos/${id}/despesas-categoria`, {
      params: params({ categoria, ano }),
    });
  }

  entity(doc: string, ano?: number | null): Observable<EntityDoc> {
    return this.http.get<EntityDoc>(`${this.base}/entidades/${doc}`, { params: params({ ano }) });
  }

  finance(p: Params): Observable<FinancePage> {
    return this.http.get<FinancePage>(`${this.base}/finance`, { params: params(p) });
  }

  earmarks(p: Params): Observable<Page<EarmarkPaymentRow>> {
    return this.http.get<Page<EarmarkPaymentRow>>(`${this.base}/emendas`, { params: params(p) });
  }

  ranking(p: Params): Observable<RankingDoc> {
    return this.http.get<RankingDoc>(`${this.base}/ranking`, { params: params(p) });
  }

  circular(p: Params): Observable<CircularDoc> {
    return this.http.get<CircularDoc>(`${this.base}/sinais/doacao-circular`, { params: params(p) });
  }

  aiReviews(p: Params): Observable<AiReviewDoc> {
    return this.http.get<AiReviewDoc>(`${this.base}/sinais/analise-ia`, { params: params(p) });
  }

  supplierPartners(p: Params): Observable<SupplierPartnerDoc> {
    return this.http.get<SupplierPartnerDoc>(`${this.base}/sinais/socio-fornecedor`, { params: params(p) });
  }

  discourse(p: Params): Observable<DiscourseDoc> {
    return this.http.get<DiscourseDoc>(`${this.base}/sinais/discurso`, { params: params(p) });
  }

  disproportionate(p: Params): Observable<DisproportionateDoc> {
    return this.http.get<DisproportionateDoc>(`${this.base}/sinais/despesa-desproporcional`, { params: params(p) });
  }

  graphSearch(q: string): Observable<{ results: GraphSearchResult[] }> {
    return this.http.get<{ results: GraphSearchResult[] }>(`${this.base}/graph/search`, { params: params({ q }) });
  }

  graphNode(cpfCnpj: string): Observable<{ node: GraphNodeInfo | null }> {
    return this.http.post<{ node: GraphNodeInfo | null }>(`${this.base}/graph/node`, { cpfCnpj });
  }

  graphExpand(cpfCnpj: string): Observable<{ nodes: GraphNodeInfo[]; edges: GraphEdge[]; truncated: boolean }> {
    return this.http.post<{ nodes: GraphNodeInfo[]; edges: GraphEdge[]; truncated: boolean }>(`${this.base}/graph/expand`, { cpfCnpj });
  }

  graphPaths(newId: string, existingIds: string[]): Observable<{ nodes: GraphNodeInfo[]; edges: GraphEdge[] }> {
    return this.http.post<{ nodes: GraphNodeInfo[]; edges: GraphEdge[] }>(`${this.base}/graph/paths`, { newId, existingIds });
  }
}
