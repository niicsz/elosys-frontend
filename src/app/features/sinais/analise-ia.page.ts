import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatInt, VERDICT_LABEL, verdictBadge } from '../../core/format';
import { pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { EmptyStateComponent, PaginationComponent } from '../../shared/components/ui.components';

const VERDICTS = ['bizarro', 'inconclusivo', 'plausivel'] as const;
const VERDICT_SIGNAL: Record<string, string> = { bizarro: 'signal--high', inconclusivo: 'signal--medium', plausivel: 'signal--low' };
const RULES = [
  { value: 'circular_donations', label: 'doação circular' },
  { value: 'disproportionate_expense', label: 'despesa desproporcional' },
];

@Component({
  selector: 'app-analise-ia-page',
  imports: [RouterLink, EmptyStateComponent, PaginationComponent],
  styles: `
    .summary { font-family: var(--font-mono); font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 8px 24px; }
    .summary strong { color: var(--fg-1); font-weight: 400; }
    ul.facts { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
    ul.facts li::before { content: '– '; color: var(--muted-2); }
    details { margin-top: 12px; }
    details summary { cursor: pointer; }
    .pager { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border-1); display: flex; justify-content: center; }
  `,
  template: `
    <div class="page stack gap-8">
      <section>
        <h1 class="page-title" style="margin: 0">O que a IA achou estranho</h1>
        <p class="lead">
          Cada sinal de <strong>doação circular</strong> ou <strong>despesa desproporcional</strong> foi passado para um modelo
          rápido e barato (Claude Haiku) com os fatos, e ele respondeu se aquilo é <em>rotineiro</em> ou
          <em>genuinamente estranho</em>. A resposta, a explicação e os fatos que o modelo citou ficam salvos junto do sinal.
          <strong>Continua sendo indício, não prova</strong> — agora com a opinião de uma máquina anexada, que também pode estar
          errada.
        </p>

        @if (data.value()?.summary; as s) {
          @if (s.total > 0) {
            <div class="summary mt-6">
              <span><strong>{{ int(s.total) }}</strong> revisados</span>
              @for (v of verdicts; track v) {
                @if (s.byVerdict[v]) {
                  <span>{{ int(s.byVerdict[v]) }} {{ verdictLabel[v] }}</span>
                }
              }
              @if (s.model) {
                <span>modelo: {{ s.model }}</span>
              }
            </div>
          }
        }

        <div class="row wrap gap-2 mt-5">
          <button type="button" class="btn" [class.btn--primary]="!verdictAtual()" (click)="nav({ verdict: null })">todos</button>
          @for (v of verdicts; track v) {
            <button type="button" class="btn" [class.btn--primary]="verdictAtual() === v" (click)="nav({ verdict: v })">{{ verdictLabel[v] }}</button>
          }
          <span class="divider-v"></span>
          <button type="button" class="btn" [class.btn--primary]="!ruleAtual()" (click)="nav({ rule: null })">toda regra</button>
          @for (r of rules; track r.value) {
            <button type="button" class="btn" [class.btn--primary]="ruleAtual() === r.value" (click)="nav({ rule: r.value })">{{ r.label }}</button>
          }
        </div>
      </section>

      <section>
        @if (data.isLoading() && !data.value()) {
          @for (i of [1, 2, 3]; track i) {
            <div class="signal mb-3"><span class="skeleton" style="width: 60%; height: 14px"></span></div>
          }
        } @else if (data.value()?.summary?.total === 0) {
          <app-empty-state title="nenhuma revisão ainda" hint="rode o job ai-review (precisa de ANTHROPIC_API_KEY)" />
        } @else if (!rows().length) {
          <app-empty-state title="sem revisões para esse filtro." />
        } @else {
          <div class="stack gap-3" [class.loading-rows]="data.isLoading()">
            @for (r of rows(); track r.signalId) {
              <article [class]="'signal ' + verdictSignal[r.verdict]">
                <div class="row wrap gap-3">
                  <span [class]="'badge ' + badge(r.verdict)">IA: {{ verdictLabel[r.verdict] }}{{ r.confidence ? ' · confiança ' + r.confidence : '' }}</span>
                  <span class="mono-label">{{ r.ruleLabel }}</span>
                  @if (r.signalAmountCents > 0) {
                    <span class="num" style="margin-left: auto; font-size: 17px">{{ brl(r.signalAmountCents) }}</span>
                  }
                </div>
                <p class="body">{{ r.explanation }}</p>
                @if (r.facts.length) {
                  <ul class="facts">
                    @for (f of r.facts; track $index) {
                      <li>{{ f }}</li>
                    }
                  </ul>
                }
                <details>
                  <summary class="mono-label">sinal original</summary>
                  <p class="mt-2" style="font-size: 12px; line-height: 1.6; color: var(--muted)">{{ r.signalExplanation }}</p>
                </details>
                @if (r.graphIds?.length) {
                  <div class="mt-4">
                    <a class="btn btn--primary" routerLink="/grafo" [queryParams]="{ add: r.graphIds!.join(',') }">Ver no grafo</a>
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
export class AnaliseIaPage {
  readonly verdict = input<string>();
  readonly rule = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);

  protected readonly verdicts = VERDICTS;
  protected readonly rules = RULES;
  protected readonly verdictLabel = VERDICT_LABEL;
  protected readonly verdictSignal = VERDICT_SIGNAL;
  protected readonly badge = verdictBadge;
  protected readonly brl = formatBRL;
  protected readonly int = formatInt;

  protected readonly verdictAtual = computed(() => ((VERDICTS as readonly string[]).includes(this.verdict() ?? '') ? this.verdict()! : null));
  protected readonly ruleAtual = computed(() => (RULES.some((r) => r.value === this.rule()) ? this.rule()! : null));
  protected readonly page = computed(() => pageParam(this.pageQ()));

  protected readonly data = rxResource({
    params: () => ({ verdict: this.verdictAtual(), rule: this.ruleAtual(), page: this.page() }),
    stream: ({ params }) => this.api.aiReviews(params),
  });

  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly totalPages = computed(() => {
    const d = this.data.value();
    return d ? Math.max(1, Math.ceil(d.total / (d.pageSize || 30))) : 1;
  });

  constructor() {
    effect(() => this.shell.setHeader('Sinais', 'Análise de IA'));
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
