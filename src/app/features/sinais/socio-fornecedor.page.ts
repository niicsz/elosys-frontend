import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatCnpj, formatInt } from '../../core/format';
import { pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { EmptyStateComponent, PaginationComponent, SearchInputComponent } from '../../shared/components/ui.components';

const FILTERS = [
  { value: 'all', label: 'todos' },
  { value: 'self', label: 'pagou a própria empresa' },
  { value: 'others', label: 'outra campanha pagou' },
];

@Component({
  selector: 'app-socio-fornecedor-page',
  imports: [RouterLink, EmptyStateComponent, PaginationComponent, SearchInputComponent],
  styles: `
    .summary { font-family: var(--font-mono); font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 8px 24px; }
    .meta { font-family: var(--font-mono); font-size: 9.5px; color: var(--muted-2); }
  `,
  template: `
    <div class="page stack gap-8">
      <section>
        <h1 class="page-title" style="margin: 0">Candidato sócio de uma empresa que recebeu dinheiro de campanha</h1>
        <p class="lead">
          O candidato aparece no <strong>quadro societário</strong> (Receita, via BrasilAPI) de uma empresa que recebeu
          pagamento de alguma campanha. <strong>A correspondência NÃO é confirmada</strong> — a fonte mascara o CPF do sócio,
          então isso casa o nome normalizado com um candidato E os 6 dígitos visíveis do CPF. Pode ser coincidência (duas
          pessoas, mesmo nome, mesmos 6 dígitos). Casos ambíguos (2+ pessoas batendo) são descartados. Indício, não prova.
        </p>

        @if (data.value()?.summary; as s) {
          @if (s.total > 0) {
            <div class="summary mt-6">
              <span><span style="color: var(--fg-1)">{{ int(s.total) }}</span> vínculos possíveis</span>
              <span><span class="text-red">{{ int(s.self) }}</span> pagaram a própria empresa</span>
              <span><span style="color: var(--accent-2)">{{ int(s.others) }}</span> pagas por outra campanha</span>
              <span><span style="color: var(--fg-1)">{{ brl(s.totalCents) }}</span> movimentados nessas empresas</span>
            </div>
          }
        }

        <div class="row wrap gap-2 mt-5">
          @for (f of filters; track f.value) {
            <button type="button" class="btn" [class.btn--primary]="filtroAtual() === f.value"
                    (click)="nav({ filtro: f.value === 'all' ? null : f.value })">{{ f.label }}</button>
          }
          <app-search-input class="ml-auto" [value]="q()" placeholder="buscar candidato ou empresa…" [width]="256" (search)="nav({ q: $event })" />
        </div>
      </section>

      <section>
        @if (data.isLoading() && !data.value()) {
          <div class="table-wrap" style="padding: 16px">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div class="skeleton mb-3" style="height: 14px; width: 100%"></div>
            }
          </div>
        } @else if (data.value()?.summary?.total === 0) {
          <app-empty-state title="nenhum vínculo ainda" hint="rode o job candidate-supplier-partner (precisa do quadro societário coletado via receita-cnpj)" />
        } @else if (!rows().length) {
          <app-empty-state title="nada para esse filtro." />
        } @else {
          <div class="table-wrap">
            <div class="scroll-x">
              <table class="table" style="min-width: 760px">
                <thead>
                  <tr>
                    <th>candidato (sócio)</th><th>empresa</th><th>papel · desde</th>
                    <th class="right">recebeu de campanhas</th><th class="right">quem pagou</th>
                  </tr>
                </thead>
                <tbody [class.loading-rows]="data.isLoading()">
                  @for (r of rows(); track r.personId + '-' + r.companyCnpj) {
                    <tr>
                      <td><a class="hover-underline" [routerLink]="['/politico', r.personId]">{{ r.personName ?? 'candidato' }}</a></td>
                      <td style="max-width: 240px">
                        <a class="hover-underline" [routerLink]="['/cnpj', r.companyCnpj]">{{ r.companyName ?? cnpj(r.companyCnpj) }}</a>
                        <div class="meta">{{ cnpj(r.companyCnpj) }}</div>
                      </td>
                      <td style="color: var(--muted)">
                        {{ r.partnerRole ?? '—' }}
                        @if (r.partnerSince) {
                          <span style="color: var(--muted-2)"> · {{ r.partnerSince }}</span>
                        }
                      </td>
                      <td class="num" style="color: var(--accent-2)">
                        {{ brl(r.paymentsTotalCents) }}
                        <div class="meta">{{ int(r.paymentsCount) }} pagamentos</div>
                      </td>
                      <td class="num">
                        @if (r.paidBySelf) {
                          <span class="text-red">a própria campanha</span>
                        } @else {
                          <span class="text-muted">{{ r.payerCandidacies }} campanha(s)</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (totalPages() > 1) {
              <div class="table-footer">
                <app-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="nav({ page: $event })" />
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
})
export class SocioFornecedorPage {
  readonly filtro = input<string>();
  readonly q = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);

  protected readonly filters = FILTERS;
  protected readonly brl = formatBRL;
  protected readonly cnpj = formatCnpj;
  protected readonly int = formatInt;

  protected readonly filtroAtual = computed(() => (FILTERS.some((f) => f.value === this.filtro()) ? this.filtro()! : 'all'));
  protected readonly page = computed(() => pageParam(this.pageQ()));

  protected readonly data = rxResource({
    params: () => ({ filter: this.filtroAtual(), q: this.q() ?? '', page: this.page() }),
    stream: ({ params }) => this.api.supplierPartners(params),
  });

  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly totalPages = computed(() => {
    const d = this.data.value();
    return d ? Math.max(1, Math.ceil(d.total / (d.pageSize || 40))) : 1;
  });

  constructor() {
    effect(() => this.shell.setHeader('Sinais', 'Sócio de fornecedor'));
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
