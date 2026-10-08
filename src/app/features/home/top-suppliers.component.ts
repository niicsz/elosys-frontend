import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatCnpj, formatInt } from '../../core/format';

@Component({
  selector: 'app-top-suppliers',
  imports: [RouterLink],
  styles: `
    .item { border-bottom: 1px solid var(--border-1); padding: 14px 0; }
    .item:last-child { border-bottom: 0; }
    .pos { width: 24px; flex: none; font-family: var(--font-mono); font-size: 11px; color: var(--muted-2); }
    .name { font-size: 14px; }
    .name:hover { color: var(--accent-2); text-decoration: underline; }
    .amount { flex: none; font-family: var(--font-mono); font-size: 13px; color: var(--accent-2); }
    .bar { height: 3px; flex: 1; background: var(--hover); }
    .bar > div { height: 3px; background: var(--accent-2); }
    .meta { flex: none; font-family: var(--font-mono); font-size: 9.5px; color: var(--muted-2); }
    h2 { margin: 8px 0 0; font-size: 20px; font-weight: 500; letter-spacing: -.01em; }
  `,
  template: `
    <section class="card">
      <div class="row wrap gap-4 mb-6" style="justify-content: space-between; align-items: flex-end">
        <div>
          <div class="label">prestação de contas eleitorais · despesas pagas a fornecedores</div>
          <h2>Empresas que mais faturaram com campanhas</h2>
        </div>
        <label class="row gap-2">
          <span class="label">eleição</span>
          <select class="select" [value]="year()" (change)="year.set($any($event.target).value)">
            <option value="all">todas</option>
            @for (y of years(); track y) {
              <option [value]="y" [selected]="String(y) === year()">{{ y }}</option>
            }
          </select>
        </label>
      </div>

      @if (data.isLoading()) {
        @for (i of skeleton; track i) {
          <div class="item">
            <div class="row gap-3">
              <span class="pos">{{ pad(i) }}</span>
              <span class="skeleton flex-1" style="height: 14px"></span>
              <span class="skeleton" style="height: 14px; width: 96px"></span>
            </div>
          </div>
        }
      } @else if (!suppliers().length) {
        <div class="mono-label" style="padding: 40px 0; text-align: center">sem despesas contratadas para esse filtro.</div>
      } @else {
        @for (s of suppliers(); track s.cnpj; let i = $index) {
          <div class="item">
            <div class="row gap-3" style="align-items: baseline">
              <span class="pos">{{ pad(i + 1) }}</span>
              <a class="name flex-1 truncate" [routerLink]="['/cnpj', s.cnpj]">{{ s.name }}</a>
              <span class="amount">{{ brl(s.totalCents) }}</span>
            </div>
            <div class="row gap-3 mt-2" style="padding-left: 36px">
              <div class="bar"><div [style.width.%]="width(s.totalCents)"></div></div>
              <span class="meta">
                {{ cnpj(s.cnpj) }} · {{ int(s.paymentCount) }} pagamentos · {{ int(s.candidacyCount) }} candidaturas
              </span>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class TopSuppliersComponent {
  readonly years = input.required<number[]>();
  readonly initialYear = input<number | null>(null);

  private readonly api = inject(ElosysApiService);

  protected readonly year = linkedSignal(() => {
    const y = this.initialYear() ?? this.years()[0];
    return y != null ? String(y) : 'all';
  });

  protected readonly data = rxResource({
    params: () => this.year(),
    stream: ({ params }) => this.api.topSuppliers(params),
  });

  protected readonly suppliers = computed(() => this.data.value()?.suppliers ?? []);
  private readonly max = computed(() => this.suppliers()[0]?.totalCents || 1);

  protected readonly skeleton = Array.from({ length: 10 }, (_, i) => i + 1);
  protected readonly String = String;
  protected readonly brl = formatBRL;
  protected readonly cnpj = formatCnpj;
  protected readonly int = formatInt;

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  protected width(cents: number): number {
    return Math.max(2, (cents / this.max()) * 100);
  }
}
