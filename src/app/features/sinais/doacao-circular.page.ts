import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { entityLink, formatBRL, formatCpfCnpj, formatInt, SEVERITY_LABEL, severityBadge } from '../../core/format';
import { pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { AiBadgeComponent } from '../../shared/components/cards.components';
import { EmptyStateComponent, PaginationComponent } from '../../shared/components/ui.components';

const SEVERITIES = ['high', 'medium', 'low'] as const;
const SORTS = [
  { value: 'severity', label: 'severidade' },
  { value: 'amount', label: 'valor movimentado' },
  { value: 'path_length', label: 'tamanho do caminho' },
];

@Component({
  selector: 'app-doacao-circular-page',
  imports: [RouterLink, AiBadgeComponent, EmptyStateComponent, PaginationComponent],
  styles: `
    .chip { font-family: var(--font-mono); font-size: 10px; color: var(--muted); border: 1px solid var(--border-1); border-radius: var(--r-sm); padding: 4px 8px; display: inline-block; }
    a.chip:hover { opacity: .7; }
    .summary { font-family: var(--font-mono); font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 8px 24px; }
    .summary strong { color: var(--fg-1); font-weight: 400; }
    .pager { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border-1); display: flex; justify-content: center; }
  `,
  template: `
    <div class="page stack gap-8">
      <section>
        <h1 class="page-title" style="margin: 0">Loops de doação/despesa entre campanhas</h1>
        <p class="lead">
          Cada sinal abaixo é um ciclo real de movimentação encontrado na base inteira: dinheiro que saiu de uma campanha e,
          seguindo doações e despesas, voltou pra mesma cadeia. <strong>Isso é indício, não prova</strong> — pode ser
          coincidência entre campanhas de coligação, ressarcimento, ou merecer uma checagem manual mais de perto.
        </p>

        @if (summary(); as s) {
          <div class="summary mt-6">
            <span><strong>{{ int(s.total) }}</strong> sinais total</span>
            @for (sv of severities; track sv) {
              @if (s.bySeverity[sv]) {
                <span>{{ int(s.bySeverity[sv]) }} {{ sevLabel[sv] }}</span>
              }
            }
            @if (s.maxDepth != null) {
              <span>profundidade máxima: {{ s.maxDepth }} nós</span>
            }
            @if (s.runAt) {
              <span>última execução: {{ s.runAt }}</span>
            }
          </div>
        }

        <div class="row wrap gap-2 mt-5">
          <button type="button" class="btn" [class.btn--primary]="!sev()" (click)="nav({ severity: null })">todas</button>
          @for (sv of severities; track sv) {
            <button type="button" class="btn" [class.btn--primary]="sev() === sv" (click)="nav({ severity: sv })">{{ sevLabel[sv] }}</button>
          }
          <span class="divider-v"></span>
          <span class="label">ordenar por</span>
          @for (s of sorts; track s.value) {
            <button type="button" class="btn" [class.btn--primary]="sortAtual() === s.value"
                    (click)="nav({ sort: s.value === 'severity' ? null : s.value })">{{ s.label }}</button>
          }
        </div>
      </section>

      <section>
        @if (data.isLoading() && !data.value()) {
          @for (i of [1, 2, 3]; track i) {
            <div class="signal mb-3"><span class="skeleton" style="width: 60%; height: 14px"></span></div>
          }
        } @else if (summary()?.total === 0) {
          <app-empty-state title="nenhum sinal ainda" hint="rode o job rule-circular-donations (CLI ou POST /api/admin/jobs/rule-circular-donations)" />
        } @else if (!rows().length) {
          <app-empty-state title="sem sinais para esse filtro." />
        } @else {
          <div class="stack gap-3" [class.loading-rows]="data.isLoading()">
            @for (s of rows(); track s.id) {
              <article [class]="'signal signal--' + s.severity">
                <div class="row wrap gap-3">
                  <span [class]="'badge ' + sevBadge(s.severity)">severidade {{ sevLabel[s.severity] ?? s.severity }}</span>
                  <span class="mono" style="font-size: 10px; color: var(--muted-2)">{{ s.pathLength }} {{ s.pathLength === 1 ? 'nó' : 'nós' }}</span>
                  @if (s.aiReview; as r) {
                    <app-ai-badge [review]="r" />
                  }
                  <span class="num" style="margin-left: auto; font-size: 17px">{{ brl(s.amountCents) }}</span>
                </div>
                <p class="body">{{ s.explanation }}</p>
                @if (s.aiReview; as r) {
                  <p class="ai-note"><span class="mono-label">IA · {{ r.model }}</span> {{ r.explanation }}</p>
                }
                @if (s.actors.length) {
                  <div class="row wrap gap-2 mt-4">
                    @for (a of s.actors; track a.cpfCnpj) {
                      @if (link(a.cpfCnpj); as l) {
                        <a class="chip" [routerLink]="l">{{ a.label !== a.cpfCnpj ? a.label + ' · ' : '' }}{{ doc(a.cpfCnpj) }}</a>
                      } @else {
                        <span class="chip">{{ a.label !== a.cpfCnpj ? a.label + ' · ' : '' }}{{ doc(a.cpfCnpj) }}</span>
                      }
                    }
                  </div>
                  <div class="mt-4">
                    <a class="btn btn--primary" routerLink="/grafo" [queryParams]="{ add: addParam(s.actors) }">Ver no grafo</a>
                  </div>
                }
              </article>
            }
          </div>
        }

        @if (totalPages() > 1) {
          <div class="pager">
            <app-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="nav({ page: $event })" />
          </div>
        }
      </section>
    </div>
  `,
})
export class DoacaoCircularPage {
  readonly severity = input<string>();
  readonly sort = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);

  protected readonly severities = SEVERITIES;
  protected readonly sorts = SORTS;
  protected readonly sevLabel = SEVERITY_LABEL;
  protected readonly sevBadge = severityBadge;
  protected readonly brl = formatBRL;
  protected readonly int = formatInt;
  protected readonly doc = formatCpfCnpj;
  protected readonly link = entityLink;

  protected readonly sev = computed(() => (SEVERITIES as readonly string[]).includes(this.severity() ?? '') ? this.severity()! : null);
  protected readonly sortAtual = computed(() => (SORTS.some((s) => s.value === this.sort()) ? this.sort()! : 'severity'));
  protected readonly page = computed(() => pageParam(this.pageQ()));

  protected readonly data = rxResource({
    params: () => ({ severity: this.sev(), sort: this.sortAtual(), page: this.page() }),
    stream: ({ params }) => this.api.circular(params),
  });

  protected readonly summary = computed(() => this.data.value()?.summary ?? null);
  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly totalPages = computed(() => {
    const d = this.data.value();
    if (!d) return 1;
    const shown = this.sev() ? (d.summary.bySeverity[this.sev()!] ?? 0) : d.summary.total;
    return Math.max(1, Math.ceil(shown / (d.pageSize || 50)));
  });

  constructor() {
    effect(() => this.shell.setHeader('Sinais', 'Doação circular'));
  }

  protected addParam(actors: { cpfCnpj: string }[]): string {
    return actors.map((a) => a.cpfCnpj).join(',');
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
