import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ElosysApiService } from '../../core/elosys-api.service';
import { expenseCategoryLabel, formatBRL, formatInt, formatPct } from '../../core/format';
import { MetaService } from '../../core/meta.service';
import { pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { SourceZoneDirective } from '../../shared/components/source-zone.directive';
import { AvatarComponent, EmptyStateComponent, PaginationComponent } from '../../shared/components/ui.components';
import { ExpenseCategoryDetailRow, ExpenseCategoryRow } from '../../shared/models/api.models';

const ALL = 'TODAS';

interface Detail {
  loading: boolean;
  rows: ExpenseCategoryDetailRow[];
}

@Component({
  selector: 'app-despesa-desproporcional-page',
  imports: [RouterLink, SourceZoneDirective, AvatarComponent, EmptyStateComponent, PaginationComponent],
  styles: `
    tr.main { cursor: pointer; }
    .meta { font-size: 9.5px; color: var(--muted-2); }
    .chev { width: 12px; color: var(--muted-2); font-size: 11px; }
    .detail { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border-1); }
    .detail:last-child { border-bottom: 0; }
  `,
  template: `
    <div class="page stack gap-8">
      <section>
        <div class="row wrap gap-3" style="justify-content: space-between; align-items: flex-start">
          <h1 class="page-title" style="margin: 0">Quem mais gastou em itens baratos, por categoria</h1>
          @if (years().length) {
            <select class="select" (change)="nav({ ano: $any($event.target).value })" aria-label="ano">
              <option [value]="ALL" [selected]="year() == null">todos</option>
              @for (y of years(); track y) {
                <option [value]="y" [selected]="y === year()">{{ y }}</option>
              }
            </select>
          }
        </div>
        <p class="lead">
          Compara o gasto de cada candidato em itens baratos (canetas, adesivos, crachás…) com a
          <strong>mediana histórica da categoria</strong> e com a média de pares de <strong>mesmo cargo e estado</strong>.
          Indício de desproporção, não fraude confirmada.
        </p>
        <div class="row wrap gap-2 mt-5">
          <span class="label">categoria</span>
          <select class="select" (change)="nav({ categoria: $any($event.target).value === ALL ? null : $any($event.target).value })" aria-label="categoria">
            <option [value]="ALL" [selected]="!cat()">todas</option>
            @for (c of categories(); track c) {
              <option [value]="c" [selected]="cat() === c">{{ catLabel(c) }}</option>
            }
          </select>
          @if (data.value()?.signalsCount) {
            <span class="mono ml-auto" style="font-size: 11px; color: var(--muted)">{{ int(data.value()!.signalsCount) }} sinais gerados pela regra</span>
          }
        </div>
      </section>

      <section>
        @if (meta() && !years().length) {
          <app-empty-state title="nenhuma despesa de campanha coletada ainda" hint="rode o job tse-accounts" />
        } @else if (data.isLoading() && !data.value()) {
          <div class="table-wrap" style="padding: 16px">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div class="skeleton mb-3" style="height: 14px; width: 100%"></div>
            }
          </div>
        } @else if (!rows().length) {
          <app-empty-state [title]="'ninguém gastou em ' + categoryText() + ' em ' + (year() ?? 'todos os anos') + '.'" />
        } @else {
          <div class="table-wrap">
            <div class="scroll-x">
              <table class="table" style="min-width: 820px">
                <thead>
                  <tr><th>candidato</th><th>cargo/estado</th><th class="right">gasto</th><th class="right">% receita</th><th class="right">média dos pares</th></tr>
                </thead>
                <tbody [class.loading-rows]="data.isLoading()">
                  @for (r of rows(); track r.personId) {
                    <tr class="main" (click)="toggle(r)">
                      <td>
                        <div class="row gap-2">
                          <span class="chev" aria-hidden="true">{{ details()[r.personId] ? '▾' : '▸' }}</span>
                          <app-avatar [photoUrl]="r.photoUrl" [name]="r.name ?? '?'" />
                          <a class="hover-underline" [routerLink]="['/politico', r.personId]" (click)="$event.stopPropagation()">{{ r.name ?? 'candidato' }}</a>
                        </div>
                      </td>
                      <td style="color: var(--muted)">
                        {{ r.office ?? '—' }}
                        @if (r.state) {
                          <span style="color: var(--muted-2)"> · {{ r.state }}</span>
                        }
                      </td>
                      <td class="num" style="color: var(--accent-2)">
                        {{ brl(r.categoryCents) }}
                        <div class="meta">{{ int(r.categoryCount) }} despesa(s)</div>
                      </td>
                      <td class="num">
                        {{ r.sharePct != null ? pct(r.sharePct) : '—' }}
                        @if (r.revenueCents === 0) {
                          <div class="meta">sem receita declarada</div>
                        }
                      </td>
                      <td class="num">
                        @if (r.peerAvgSharePct != null) {
                          {{ pct(r.peerAvgSharePct) }}
                          <div class="meta">
                            {{ r.peerCount }} par(es)
                            @if (timesPeer(r); as t) {
                              <span class="text-red"> · {{ t.toFixed(1) }}x a média</span>
                            }
                          </div>
                        } @else {
                          —
                        }
                      </td>
                    </tr>
                    @if (details()[r.personId]; as det) {
                      <tr>
                        <td colspan="5" style="padding-top: 0; padding-bottom: 10px">
                          @if (det.loading) {
                            <div class="stack gap-2" style="padding: 4px 0">
                              <span class="skeleton" style="height: 12px; width: 100%"></span>
                              <span class="skeleton" style="height: 12px; width: 80%"></span>
                            </div>
                          } @else if (!det.rows.length) {
                            <div style="font-size: 11px; color: var(--muted)">nenhuma despesa encontrada.</div>
                          } @else {
                            @for (d of det.rows; track d.id) {
                              <div class="detail" [appSourceZone]="d.provenance">
                                <div class="flex-1">
                                  <div class="truncate" style="font-size: 11.5px; color: var(--fg-2)">{{ d.description }}</div>
                                  <div class="mono-label" style="font-size: 8.5px">{{ d.year }}</div>
                                </div>
                                <div class="num none" style="font-size: 12px; color: var(--accent-2)">{{ brl(d.amountCents) }}</div>
                              </div>
                            }
                          }
                        </td>
                      </tr>
                    }
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
export class DespesaDesproporcionalPage {
  readonly categoria = input<string>();
  readonly ano = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);
  protected readonly meta = inject(MetaService).meta;

  protected readonly ALL = ALL;
  protected readonly brl = formatBRL;
  protected readonly int = formatInt;
  protected readonly pct = formatPct;
  protected readonly catLabel = expenseCategoryLabel;

  protected readonly years = computed(() => this.meta()?.expenseYears ?? []);
  protected readonly categories = computed(() => this.meta()?.expenseCategories ?? []);
  protected readonly cat = computed(() => {
    const c = this.categoria();
    return c && this.categories().includes(c) ? c : null;
  });
  protected readonly year = computed<number | null>(() => {
    const a = this.ano();
    if (a === ALL) return null;
    const n = Number(a);
    return this.years().includes(n) ? n : (this.years()[0] ?? null);
  });
  protected readonly page = computed(() => pageParam(this.pageQ()));
  protected readonly categoryText = computed(() =>
    this.cat() ? expenseCategoryLabel(this.cat()!).toLowerCase() : 'itens baratos (todas as categorias)',
  );

  protected readonly data = rxResource({
    params: () => (this.meta() ? { categoria: this.cat(), ano: this.year(), page: this.page() } : undefined),
    stream: ({ params }) => (params ? this.api.disproportionate(params) : of(undefined)),
  });

  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly totalPages = computed(() => {
    const d = this.data.value();
    return d ? Math.max(1, Math.ceil(d.total / (d.pageSize || 40))) : 1;
  });

  protected readonly details = signal<Record<number, Detail>>({});

  constructor() {
    effect(() => this.shell.setHeader('Sinais', 'Despesa desproporcional'));
    effect(() => {
      this.data.value();
      this.details.set({});
    });
  }

  protected toggle(r: ExpenseCategoryRow): void {
    const current = { ...this.details() };
    if (current[r.personId]) {
      delete current[r.personId];
      this.details.set(current);
      return;
    }
    this.details.set({ ...current, [r.personId]: { loading: true, rows: [] } });
    this.api.politicianCategoryExpenses(r.personId, this.cat(), this.year()).subscribe({
      next: (d) => this.patchDetail(r.personId, { loading: false, rows: d.rows }),
      error: () => this.patchDetail(r.personId, { loading: false, rows: [] }),
    });
  }

  private patchDetail(personId: number, d: Detail): void {
    if (!this.details()[personId]) return;
    this.details.set({ ...this.details(), [personId]: d });
  }

  protected timesPeer(r: ExpenseCategoryRow): number | null {
    if (r.sharePct == null || r.peerAvgSharePct == null || r.peerAvgSharePct <= 0) return null;
    const t = r.sharePct / r.peerAvgSharePct;
    return t >= 2 ? t : null;
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
