import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatCpfCnpj, formatInt } from '../../core/format';
import { FinancePage, FinanceRow, FinanceSort } from '../models/api.models';
import { FinanceFilters, FinanceFiltersDialogComponent } from './finance-filters-dialog.component';
import { SourceZoneDirective } from './source-zone.directive';
import { AvatarComponent, EmptyStateComponent, PaginationComponent } from './ui.components';

const DEFAULT_DIR: Record<FinanceSort, 'asc' | 'desc'> = {
  name: 'asc', amount: 'desc', paid: 'desc', year: 'desc', date: 'desc',
};

function reaisToCents(v: string): number | undefined {
  const t = String(v ?? '').trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

function isoDate(d: Date | null): string | undefined {
  if (!d) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
  selector: 'app-finance-table',
  imports: [RouterLink, SourceZoneDirective, AvatarComponent, EmptyStateComponent, PaginationComponent],
  template: `
    <section class="py-7">
      <div class="row wrap gap-3 mb-4" style="justify-content: space-between">
        <div class="label">{{ title() }}</div>
        <button type="button" class="btn" (click)="openFilters()">
          ⚙ filtros
          @if (activeFilterCount() > 0) {
            <span class="badge badge--flag" style="padding: 0 5px; font-size: 10px">{{ activeFilterCount() }}</span>
          }
        </button>
      </div>

      @if (data()?.total === 0 && !loading()) {
        <app-empty-state
          [title]="activeFilterCount() > 0 ? 'Nada encontrado para esses filtros.' : 'Nenhum registro.'"
          [hint]="activeFilterCount() > 0 ? 'tente ajustar ou limpar os filtros' : null" />
      } @else {
        <div class="mono mb-3" style="font-size: 10.5px; color: var(--muted-2)">
          {{ fmtInt(data()?.total ?? 0) }} {{ data()?.total === 1 ? 'registro' : 'registros' }}
        </div>
        <div class="table-wrap">
          <div class="scroll-x">
            <table class="table" style="min-width: 680px">
              <thead>
                <tr>
                  <th [class.sorted]="sort() === 'name'"><button (click)="toggleSort('name')">{{ counterpartyLabel() }} {{ arrow('name') }}</button></th>
                  <th>detalhe</th>
                  <th [class.sorted]="sort() === 'date'"><button (click)="toggleSort('date')">data {{ arrow('date') }}</button></th>
                  <th class="right" [class.sorted]="sort() === 'amount'"><button (click)="toggleSort('amount')">valor {{ arrow('amount') }}</button></th>
                  @if (showExpense()) {
                    <th class="right" [class.sorted]="sort() === 'paid'"><button (click)="toggleSort('paid')">pago {{ arrow('paid') }}</button></th>
                  }
                </tr>
              </thead>
              <tbody [class.loading-rows]="loading()">
                @if (loading() && !data()) {
                  @for (i of skeletonRows; track i) {
                    <tr>
                      <td><span class="skeleton" style="width: 160px"></span></td>
                      <td><span class="skeleton" style="width: 120px"></span></td>
                      <td><span class="skeleton" style="width: 64px"></span></td>
                      <td><span class="skeleton" style="width: 80px; margin-left: auto"></span></td>
                      @if (showExpense()) { <td><span class="skeleton" style="width: 80px; margin-left: auto"></span></td> }
                    </tr>
                  }
                }
                @for (r of data()?.rows ?? []; track r.id) {
                  <tr [appSourceZone]="r.provenance">
                    <td style="max-width: 220px">
                      @if (r.counterpartyIsPoliticianOwned) {
                        <div class="mb-2">
                          <span class="badge badge--flag" title="Um sócio desta empresa também é candidato (ver /sinais/socio-fornecedor)">⚑ empresa de político</span>
                        </div>
                      }
                      <div class="row gap-2">
                        @if (r.counterpartyPersonId != null) {
                          <app-avatar [photoUrl]="r.counterpartyPhotoUrl" [name]="name(r)" />
                        }
                        @if (link(r); as l) {
                          <a [routerLink]="l" class="link-primary">{{ name(r) }}</a>
                        } @else {
                          {{ name(r) }}
                        }
                      </div>
                      @if (r.counterpartyDoc) {
                        <div class="sub">
                          {{ doc(r.counterpartyDoc) }}{{ r.counterpartyOpenedAt ? ' (' + r.counterpartyOpenedAt.slice(0, 4) + ')' : '' }}
                        </div>
                      }
                    </td>
                    <td style="max-width: 240px; font-size: 12px; color: var(--muted)">{{ r.detail ?? '—' }}</td>
                    <td class="num" style="text-align: left; color: var(--muted)">{{ r.date ?? '—' }}</td>
                    <td class="num" [style.color]="toneColor()">{{ brl(r.amountCents) }}</td>
                    @if (showExpense()) {
                      <td class="num" style="color: var(--muted)">{{ r.paidCents != null ? brl(r.paidCents) : '—' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (totalPages() > 1) {
            <div class="table-footer">
              <app-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="page.set($event)" />
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class FinanceTableComponent {
  readonly title = input.required<string>();
  readonly scope = input.required<'candidate' | 'entity'>();
  readonly entityId = input.required<string>();
  readonly dir = input.required<'received' | 'spent' | 'given'>();
  readonly counterpartyLabel = input.required<string>();
  readonly tone = input<'green' | 'amber' | 'neutral'>('neutral');
  readonly year = input<number | null>(null);

  private readonly api = inject(ElosysApiService);
  private readonly dialog = inject(MatDialog);

  protected readonly page = signal(1);
  protected readonly sort = signal<FinanceSort>('amount');
  protected readonly order = signal<'asc' | 'desc'>('desc');
  protected readonly filters = signal<FinanceFilters>({
    q: '', dateFrom: null, dateTo: null, amountMin: '', amountMax: '', onlyPoliticianOwned: false,
  });
  protected readonly data = signal<FinancePage | null>(null);
  protected readonly loading = signal(true);
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  protected readonly showExpense = computed(
    () => this.dir() === 'spent' || (this.scope() === 'entity' && this.dir() === 'received'),
  );
  protected readonly totalPages = computed(() => {
    const d = this.data();
    return d ? Math.max(1, Math.ceil(d.total / (d.pageSize || 25))) : 1;
  });
  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return (f.q.trim() ? 1 : 0) + (f.dateFrom || f.dateTo ? 1 : 0) + (f.amountMin || f.amountMax ? 1 : 0) + (f.onlyPoliticianOwned ? 1 : 0);
  });
  protected readonly toneColor = computed(() =>
    this.tone() === 'green' ? 'var(--green)' : this.tone() === 'amber' ? 'var(--accent-2)' : 'var(--fg-2)',
  );

  private sub?: Subscription;
  private lastYear: number | null | undefined = undefined;

  constructor() {
    effect(() => {
      const year = this.year();
      if (this.lastYear !== undefined && year !== this.lastYear) this.page.set(1);
      this.lastYear = year;
    });
    effect(() => {
      const f = this.filters();
      const query = {
        scope: this.scope(),
        id: this.entityId(),
        dir: this.dir(),
        page: this.page(),
        sort: this.sort(),
        order: this.order(),
        q: f.q.trim(),
        year: this.year(),
        dateFrom: isoDate(f.dateFrom),
        dateTo: isoDate(f.dateTo),
        amountMin: reaisToCents(f.amountMin),
        amountMax: reaisToCents(f.amountMax),
        onlyPoliticianOwned: f.onlyPoliticianOwned ? true : undefined,
      };
      this.loading.set(true);
      this.sub?.unsubscribe();
      this.sub = this.api.finance(query).subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  protected openFilters(): void {
    this.dialog
      .open(FinanceFiltersDialogComponent, {
        data: {
          filters: this.filters(),
          counterpartyLabel: this.counterpartyLabel(),
          showExpense: this.showExpense(),
          allowPoliticianOwned: this.scope() === 'candidate',
        },
        width: '480px',
        maxWidth: '95vw',
        panelClass: 'elosys-dialog',
      })
      .afterClosed()
      .subscribe((f?: FinanceFilters) => {
        if (!f) return;
        this.page.set(1);
        this.filters.set(f);
      });
  }

  protected toggleSort(col: FinanceSort): void {
    this.page.set(1);
    if (col === this.sort()) this.order.set(this.order() === 'asc' ? 'desc' : 'asc');
    else {
      this.sort.set(col);
      this.order.set(DEFAULT_DIR[col]);
    }
  }

  protected arrow(col: FinanceSort): string {
    return this.sort() === col ? (this.order() === 'asc' ? '▲' : '▼') : '↕';
  }

  protected name(r: FinanceRow): string {
    return r.counterpartyName ?? 'não identificado';
  }

  protected link(r: FinanceRow): string[] | null {
    if (r.counterpartyPersonId != null) return ['/politico', String(r.counterpartyPersonId)];
    const d = r.counterpartyDoc;
    if (!d) return null;
    return d.length === 14 ? ['/cnpj', d] : d.length === 11 ? ['/cpf', d] : null;
  }

  protected readonly brl = formatBRL;
  protected readonly doc = formatCpfCnpj;
  protected readonly fmtInt = formatInt;
}
