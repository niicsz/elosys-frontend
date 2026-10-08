import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatInt } from '../../core/format';
import { intParam, pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  PaginationComponent,
  YearSelectComponent,
} from '../../shared/components/ui.components';

type Tipo = 'bens' | 'crescimento';

@Component({
  selector: 'app-ranking-page',
  imports: [RouterLink, AvatarComponent, EmptyStateComponent, PaginationComponent, YearSelectComponent],
  styles: `.meta { font-family: var(--font-mono); font-size: 10px; color: var(--muted-2); }`,
  template: `
    <div class="page stack gap-8">
      <section>
        <div class="row wrap gap-3" style="justify-content: space-between; align-items: flex-start">
          <h1 class="page-title" style="margin: 0">
            Ranking de candidatos — {{ tipoAtual() === 'bens' ? 'bens declarados' : 'maior crescimento patrimonial' }}
          </h1>
          @if (tipoAtual() === 'bens') {
            <app-year-select [years]="data.value()?.years ?? []" [value]="data.value()?.year" allLabel="todos (declaração mais recente)"
                             (yearChange)="nav({ ano: $event })" />
          }
        </div>
        @if (tipoAtual() === 'bens') {
          <p class="lead">
            Quem declarou maior valor total de bens no registro de candidatura (TSE, <code>bem_candidato</code>) — soma direta
            dos valores declarados, sem nenhuma regra de detecção em cima. Em “todos os anos”, usa a declaração mais recente de
            cada pessoa (cada candidatura já declara o patrimônio completo, não um acréscimo — somar anos diferentes contaria o
            mesmo dinheiro mais de uma vez). <strong>Não é indício de nada por si só</strong> — mais bens pode ser só mais
            detalhamento na declaração, não mais patrimônio.
          </p>
        } @else {
          <p class="lead">
            Diferença entre o patrimônio declarado na candidatura mais antiga e na mais recente de cada pessoa — só entra quem
            tem pelo menos duas declarações em anos diferentes. <strong>Não é indício de nada por si só</strong> — pode ser
            detalhamento diferente entre declarações, não crescimento real de patrimônio.
          </p>
        }
        <div class="row wrap gap-2 mt-6">
          <button type="button" class="btn" [class.btn--primary]="tipoAtual() === 'bens'" (click)="nav({ tipo: null, ano: null })">bens declarados</button>
          <button type="button" class="btn" [class.btn--primary]="tipoAtual() === 'crescimento'" (click)="nav({ tipo: 'crescimento', ano: null })">maior crescimento</button>
        </div>
      </section>

      <section>
        @if (data.isLoading() && !data.value()) {
          <div class="table-wrap" style="padding: 16px">
            @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
              <div class="skeleton mb-3" style="height: 14px; width: 100%"></div>
            }
          </div>
        } @else if (!rows().length) {
          <app-empty-state
            [title]="tipoAtual() === 'bens' ? 'nenhum candidato com bens declarados.' : 'nenhum candidato com pelo menos duas declarações de bens em anos diferentes.'" />
        } @else {
          <div class="table-wrap">
            <div class="scroll-x">
              <table class="table" style="min-width: 680px">
                <thead>
                  <tr>
                    <th style="width: 40px">#</th>
                    <th>candidato</th>
                    @if (tipoAtual() === 'bens') {
                      <th class="right">quantidade de bens</th>
                      <th class="right sorted">valor total declarado</th>
                    } @else {
                      <th class="right">1ª declaração</th>
                      <th class="right">última declaração</th>
                      <th class="right sorted">crescimento</th>
                    }
                  </tr>
                </thead>
                <tbody [class.loading-rows]="data.isLoading()">
                  @for (r of rows(); track r.personId; let i = $index) {
                    <tr>
                      <td class="num" style="color: var(--muted-2); text-align: left">{{ offset() + i + 1 }}</td>
                      <td>
                        <div class="row gap-2">
                          <app-avatar [photoUrl]="r.photoUrl" [name]="r.name ?? '?'" />
                          <div>
                            <a class="hover-underline" [routerLink]="['/politico', r.personId]">{{ r.name ?? '(sem nome)' }}</a>
                            @if (r.office) {
                              <div class="meta">
                                {{ r.office }}{{ r.partyAbbr ? ' · ' + r.partyAbbr : '' }}{{ r.state ? '/' + r.state : '' }}{{ tipoAtual() === 'bens' && r.year ? ' · ' + r.year : '' }}
                              </div>
                            }
                          </div>
                        </div>
                      </td>
                      @if (tipoAtual() === 'bens') {
                        <td class="num">{{ int(r.assetCount) }}</td>
                        <td class="num">{{ brl(r.assetTotalCents) }}</td>
                      } @else {
                        <td class="num" style="color: var(--muted)">{{ brl(r.firstCents) }}<div class="meta">{{ r.firstYear }}</div></td>
                        <td class="num" style="color: var(--muted)">{{ brl(r.lastCents) }}<div class="meta">{{ r.lastYear }}</div></td>
                        <td class="num" [class.text-green]="r.growthCents >= 0" [class.text-red]="r.growthCents < 0">
                          {{ r.growthCents >= 0 ? '+' : '' }}{{ brl(r.growthCents) }}
                          @if (r.growthPct != null) {
                            <div class="meta">{{ r.growthPct >= 0 ? '+' : '' }}{{ pct(r.growthPct) }}%</div>
                          }
                        </td>
                      }
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
export class RankingPage {
  readonly tipo = input<string>();
  readonly ano = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);

  protected readonly tipoAtual = computed<Tipo>(() => (this.tipo() === 'crescimento' ? 'crescimento' : 'bens'));
  protected readonly page = computed(() => pageParam(this.pageQ()));

  protected readonly data = rxResource({
    params: () => ({ tipo: this.tipoAtual(), ano: this.tipoAtual() === 'bens' ? intParam(this.ano()) : null, page: this.page() }),
    stream: ({ params }) => this.api.ranking(params),
  });

  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  private readonly pageSize = computed(() => this.data.value()?.pageSize || 50);
  protected readonly offset = computed(() => (this.page() - 1) * this.pageSize());
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil((this.data.value()?.total ?? 0) / this.pageSize())));

  protected readonly brl = formatBRL;
  protected readonly int = formatInt;

  constructor() {
    effect(() => this.shell.setHeader('EloSys', 'Ranking'));
  }

  protected pct(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
