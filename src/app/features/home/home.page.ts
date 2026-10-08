import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatInt } from '../../core/format';
import { intParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { YearSelectComponent } from '../../shared/components/ui.components';
import { TopSuppliersComponent } from './top-suppliers.component';

@Component({
  selector: 'app-home-page',
  imports: [YearSelectComponent, TopSuppliersComponent],
  styles: `
    .hero {
      position: relative; overflow: hidden; border-radius: var(--r-page); border: 1px solid var(--border-1);
      padding: 80px 48px;
    }
    .hero-grid {
      position: absolute; inset: 0; pointer-events: none;
      background-image: linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px);
      background-size: 64px 64px;
      mask-image: radial-gradient(900px 420px at 22% 30%, #000, transparent 72%);
    }
    .hero-glow {
      position: absolute; inset: -40% auto auto -10%; width: 70%; height: 140%; pointer-events: none;
      background: radial-gradient(closest-side, rgba(var(--accent-rgb), .14), transparent);
    }
    h1 { position: relative; margin: 0; font-size: clamp(30px, 5vw, 48px); line-height: 1.06; font-weight: 500; letter-spacing: -.02em; text-wrap: balance; }
    .hero p { position: relative; margin-top: 20px; max-width: 36rem; font-size: 15px; line-height: 1.6; color: var(--muted); }
    .search { position: relative; margin-top: 32px; max-width: 560px; cursor: text; padding: 12px 14px; }
    .search span:first-child { color: var(--muted-2); font-size: 14px; }
    @media (max-width: 640px) { .hero { padding: 48px 24px; } }
  `,
  template: `
    <div class="page stack gap-10">
      <div class="row wrap gap-3" style="justify-content: flex-end">
        <app-year-select [years]="years()" [value]="year()" allLabel="todos os anos" (yearChange)="setYear($event)" />
      </div>

      <div class="hero animate-in">
        <div class="hero-glow" aria-hidden="true"></div>
        <div class="hero-grid" aria-hidden="true"></div>
        <div style="position: relative; max-width: 42rem">
          <div class="mono-label mb-4">busca de dados públicos · CPF/CNPJ</div>
          <h1>
            Ficha pública de <span class="text-muted">qualquer candidato</span> brasileiro<span class="text-accent">.</span>
          </h1>
          <p>
            Busque por nome ou CPF. Cada campo mostra de qual arquivo do TSE ele saiu, quando foi baixado e o hash que
            comprova que não foi alterado.
          </p>
          <button type="button" class="input search" (click)="shell.paletteOpen.set(true)">
            <span>⌕ buscar por nome ou CPF…</span>
            <span class="input__kbd">Ctrl K</span>
          </button>
        </div>
      </div>

      <section class="animate-in" style="animation-delay: 80ms">
        <div class="kpis">
          @for (s of kpis(); track s.label) {
            <div class="kpi">
              <div class="kpi__label">{{ s.label }}</div>
              @if (home.isLoading()) {
                <div class="kpi__value"><span class="skeleton" style="width: 90px; height: 18px"></span></div>
              } @else {
                <div class="kpi__value" [class.kpi__value--green]="s.green">{{ s.value }}</div>
              }
            </div>
          }
        </div>
      </section>

      @if (years().length) {
        <div class="animate-in" style="animation-delay: 150ms">
          <app-top-suppliers [years]="years()" [initialYear]="year()" />
        </div>
      }

      <div class="card animate-in" style="max-width: 42rem; animation-delay: 220ms">
        <div class="label mb-3">indício não é prova</div>
        <p class="text-muted" style="font-size: 13.5px; line-height: 1.65; margin: 0">
          O EloSys reúne dados que já são públicos por lei (registro de candidatura do TSE, prestação de contas
          eleitorais, redes sociais declaradas) e os organiza por pessoa. Nada aqui é acusação — é o dado bruto oficial,
          com a fonte exposta em cada campo, para que qualquer um confira e vá além se quiser apurar.
        </p>
      </div>
    </div>
  `,
})
export class HomePage {
  readonly ano = input<string>();

  protected readonly shell = inject(ShellService);
  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);

  protected readonly home = rxResource({
    params: () => intParam(this.ano()),
    stream: ({ params }) => this.api.home(params),
  });

  protected readonly years = computed(() => this.home.value()?.years ?? []);
  protected readonly year = computed(() => this.home.value()?.year ?? null);

  protected readonly kpis = computed(() => {
    const s = this.home.value()?.stats;
    const y = this.year();
    return [
      { label: 'pessoas', value: formatInt(s?.people), green: false },
      { label: 'candidaturas', value: formatInt(s?.candidacies), green: false },
      { label: 'doações recebidas', value: formatBRL(s?.donationsTotalCents), green: true },
      { label: 'despesas contratadas', value: formatBRL(s?.expensesTotalCents), green: false },
      { label: y ? 'eleição' : 'período coberto', value: s?.years ?? '—', green: false },
    ];
  });

  constructor() {
    effect(() => this.shell.setHeader('EloSys', 'Início'));
  }

  protected setYear(y: number | null): void {
    patchQuery(this.router, { ano: y });
  }
}
