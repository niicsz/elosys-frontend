import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatCnpj, formatCpf, formatInt, resultTone } from '../../core/format';
import { intParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import {
  CycleGraphComponent,
  SignalCardComponent,
  SocialCardComponent,
  TweetCardComponent,
  signalRoleLabel,
} from '../../shared/components/cards.components';
import { FinanceTableComponent } from '../../shared/components/finance-table.component';
import { SourceZoneDirective } from '../../shared/components/source-zone.directive';
import {
  AvatarComponent,
  EmptyStateComponent,
  SectionComponent,
  YearSelectComponent,
} from '../../shared/components/ui.components';
import { Candidacy } from '../../shared/models/api.models';
import { AssetsChartComponent, AssetsYearCardsComponent } from './assets.components';
import { PoliticianNetworkComponent } from './politician-network.component';

@Component({
  selector: 'app-politico-page',
  imports: [
    RouterLink,
    SourceZoneDirective,
    AvatarComponent,
    EmptyStateComponent,
    SectionComponent,
    YearSelectComponent,
    FinanceTableComponent,
    CycleGraphComponent,
    SignalCardComponent,
    SocialCardComponent,
    TweetCardComponent,
    AssetsChartComponent,
    AssetsYearCardsComponent,
    PoliticianNetworkComponent,
  ],
  styles: `
    .page { max-width: 960px; }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 42px); line-height: 1.15; font-weight: 300; letter-spacing: -.02em; text-wrap: balance; }
    .ids { display: flex; flex-wrap: wrap; gap: 12px 32px; margin-top: 20px; font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
    .cand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
    .cand { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
    .toc { position: sticky; top: calc(var(--navbar-h, 56px) + 8px); z-index: 10; display: flex; gap: 4px; flex-wrap: wrap;
           padding: 8px 0; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--border-1); }
    .toc a { font-family: var(--font-mono); font-size: 11px; color: var(--muted-2); padding: 4px 8px; border-radius: var(--r-sm); }
    .toc a:hover { color: var(--fg-1); background: var(--hover); }
  `,
  template: `
    <div class="page">
      @if (doc.error()) {
        <app-empty-state title="Pessoa não encontrada." hint="o identificador não existe na base" icon="∅" />
      } @else if (!d()) {
        <div class="py-7">
          <div class="row gap-4">
            <span class="skeleton" style="width: 72px; height: 72px; border-radius: 999px"></span>
            <span class="skeleton" style="width: 360px; height: 36px"></span>
          </div>
          <div class="kpis mt-6">
            @for (i of [1, 2, 3]; track i) {
              <div class="kpi"><span class="skeleton" style="width: 120px; height: 20px"></span></div>
            }
          </div>
        </div>
      } @else {
        @let p = d()!;
        <div class="row wrap gap-3 mb-4" style="justify-content: flex-end">
          <app-year-select [years]="p.years" [value]="p.year" (yearChange)="setYear($event)" />
        </div>

        <header class="animate-in" style="padding-bottom: 32px">
          <div class="row gap-4">
            @if (p.photoUrl) {
              <span [appSourceZone]="p.photoProvenance">
                <app-avatar [photoUrl]="p.photoUrl" [name]="displayName()" [size]="72" />
              </span>
            }
            <h1 [appSourceZone]="p.header.provenance">{{ displayName() }}</h1>
          </div>
          @if (p.header.latestCandidacy; as lc) {
            <div class="mt-2 text-muted" style="font-size: 14px" [appSourceZone]="p.header.provenance">
              {{ lc.office ?? 'cargo n/d' }} · {{ lc.partyAbbr ?? 's/partido' }}/{{ lc.state ?? '—' }} · {{ lc.year }}
            </div>
          }
          <div class="ids">
            <span [appSourceZone]="p.header.provenance">
              <span class="text-muted-2">CPF </span>{{ cpf(p.header.person.cpf) }}
              @if (p.header.person.cpf && !p.header.person.cpfTrusted) {
                <span class="text-accent" style="margin-left: 6px">reconciliado</span>
              }
            </span>
            <span [appSourceZone]="p.header.provenance">
              <span class="text-muted-2">título eleitoral </span>{{ p.header.person.voterId ?? 'não disponível' }}
            </span>
          </div>

          @if (p.finance.donationsCount > 0 || p.finance.expensesCount > 0) {
            <div class="kpis mt-6">
              <div class="kpi">
                <div class="kpi__label">recebido em doações {{ p.year ? 'em ' + p.year : '(todas as eleições)' }}</div>
                <div class="kpi__value kpi__value--green">{{ brl(p.finance.donationsTotalCents) }}</div>
                <div class="kpi__sub">{{ int(p.finance.donationsCount) }} doações</div>
              </div>
              <div class="kpi">
                <div class="kpi__label">despesas contratadas</div>
                <div class="kpi__value">{{ brl(p.finance.expensesTotalCents) }}</div>
                <div class="kpi__sub">{{ int(p.finance.expensesCount) }} despesas</div>
              </div>
              <div class="kpi">
                <div class="kpi__label">pago até agora</div>
                <div class="kpi__value">{{ brl(p.finance.paymentsTotalCents) }}</div>
                <div class="kpi__sub">regime de caixa</div>
              </div>
            </div>
          }
        </header>

        <nav class="toc" aria-label="seções">
          @for (t of toc(); track t.id) {
            <a [routerLink]="[]" [fragment]="t.id" queryParamsHandling="preserve">{{ t.label }}</a>
          }
        </nav>

        @if (p.candidacies.length) {
          <app-section title="candidaturas por eleição" anchor="candidaturas">
            <div class="cand-grid">
              @for (c of p.candidacies; track c.id) {
                <div class="card cand" [appSourceZone]="c.provenance">
                  <div class="row" style="justify-content: space-between">
                    <span class="mono" style="font-size: 13px; color: var(--fg-2)">{{ c.year }}</span>
                    <span class="mono" style="font-size: 10.5px" [style.color]="toneColor(c)">{{ c.result ?? 'sem resultado' }}</span>
                  </div>
                  <div class="truncate" style="font-size: 13.5px">{{ c.office ?? 'cargo não informado' }}</div>
                  <div class="truncate mono" style="font-size: 10px; color: var(--muted-2)">
                    {{ c.partyAbbr ?? 's/partido' }} · {{ c.state ?? '—' }}{{ c.round ? ' · ' + c.round + 'º turno' : '' }}
                  </div>
                  @if (cnpjByYear().get(c.year); as cnpj) {
                    <a class="truncate mono hover-underline" style="font-size: 10px; color: var(--accent-2)" [routerLink]="['/cnpj', cnpj]">{{ fmtCnpj(cnpj) }}</a>
                  }
                </div>
              }
            </div>
          </app-section>
        }

        @if (p.assets.declaredAssets.length) {
          <app-section title="bens declarados" anchor="bens-declarados">
            @if (p.assets.declaredAssetsByYear.length > 1) {
              <div class="mb-6">
                <div class="label mb-2">patrimônio declarado por eleição</div>
                <app-assets-chart [data]="p.assets.declaredAssetsByYear" />
              </div>
            }
            <app-assets-year-cards [byYear]="p.assets.declaredAssetsByYear" [assets]="p.assets.declaredAssets" />
          </app-section>
        }

        @if (p.earmarks.earmarks.length) {
          <app-section title="emendas parlamentares" anchor="emendas-parlamentares">
            <p class="hint mb-4">
              Emendas ao orçamento federal autoradas por esta pessoa (Portal da Transparência) — o autor é identificado só
              por nome, não por CPF, então é um cruzamento provável, não uma identidade confirmada.
            </p>
            <div class="kpis mb-6">
              <div class="kpi">
                <div class="kpi__label">valor empenhado</div>
                <div class="kpi__value">{{ brl(p.earmarks.totalCommittedCents) }}</div>
                <div class="kpi__sub">{{ int(p.earmarks.earmarks.length) }} emendas</div>
              </div>
              <div class="kpi">
                <div class="kpi__label">valor pago</div>
                <div class="kpi__value">{{ brl(p.earmarks.totalPaidCents) }}</div>
              </div>
            </div>
            <div class="table-wrap">
              <div class="scroll-x">
                <table class="table" style="min-width: 640px">
                  <thead>
                    <tr><th>ano</th><th>localidade</th><th>ação</th><th class="right">empenhado</th><th class="right">pago</th></tr>
                  </thead>
                  <tbody>
                    @for (e of p.earmarks.earmarks; track e.id) {
                      <tr [appSourceZone]="e.provenance">
                        <td class="num" style="text-align: left">{{ e.year }}</td>
                        <td style="max-width: 220px">{{ e.locality ?? (e.municipality && e.state ? e.municipality + '/' + e.state : '—') }}</td>
                        <td style="max-width: 260px; font-size: 12px; color: var(--muted)">{{ e.actionName ?? e.functionName ?? '—' }}</td>
                        <td class="num">{{ e.committedCents != null ? brl(e.committedCents) : '—' }}</td>
                        <td class="num" style="color: var(--muted)">{{ e.paidCents != null ? brl(e.paidCents) : '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </app-section>
        }

        @if (p.donationNetwork.donatedTo.length || p.donationNetwork.receivedFrom.length) {
          <app-section title="rede de doação" anchor="rede-de-doacao">
            <app-politician-network [network]="p.donationNetwork" [centerLabel]="displayName()" [centerPhotoUrl]="p.photoUrl" />
          </app-section>
        }

        @if (p.signals.signals.length) {
          <section id="sinais" class="animate-in py-7">
            <div class="row gap-3 mb-2" style="align-items: baseline">
              <div class="section-title text-red">sinais de alerta</div>
              <span class="mono" style="font-size: 9px; color: var(--muted-2)">
                {{ p.signals.signalsCount }} {{ p.signals.signalsCount === 1 ? 'sinal' : 'sinais' }}
                {{ p.signals.signalsCount > p.signals.signals.length ? ' · mostrando os ' + p.signals.signals.length + ' maiores' : '' }}
              </span>
            </div>
            <p class="hint mb-4">Gerado por regras sobre dados já coletados — indício, não prova.</p>
            <div class="grid-2">
              @for (s of p.signals.signals; track s.id) {
                @if (s.cycleNodes?.length) {
                  <app-cycle-graph
                    [nodes]="s.cycleNodes!"
                    [selfCpfCnpj]="p.header.person.cpf"
                    [edgeAmounts]="s.cycleEdgeAmounts ?? []"
                    [severity]="s.severity"
                    [roleLabel]="roleLabel(s.role)"
                    [aiReview]="s.aiReview"
                    [amountCents]="s.cycleAmountCents"
                    [pathLength]="s.cyclePathLength"
                    [graphIds]="s.graphIds" />
                } @else {
                  <app-signal-card [signal]="s" />
                }
              }
            </div>
          </section>
        }

        @if (p.years.length) {
          <div id="financas">
            @if (p.finance.donationsCount > 0) {
              <app-finance-table title="doações recebidas" scope="candidate" [entityId]="idStr()" dir="received"
                                 counterpartyLabel="doador" tone="green" [year]="p.year" />
            }
            @if (p.finance.expensesCount > 0) {
              <app-finance-table title="despesas — pra onde foi o dinheiro" scope="candidate" [entityId]="idStr()" dir="spent"
                                 counterpartyLabel="fornecedor" tone="amber" [year]="p.year" />
            }
            @if (p.finance.donationsCount === 0 && p.finance.expensesCount === 0) {
              <div class="py-7">
                <app-empty-state [title]="'Nenhuma doação ou despesa registrada' + (p.year ? ' em ' + p.year : '') + '.'" [compact]="true" />
              </div>
            }
          </div>
        }

        @if (p.socialMedia.length) {
          <app-section title="redes sociais declaradas" anchor="redes-sociais">
            <div class="row wrap gap-2">
              @for (s of p.socialMedia; track s.id) {
                <span [appSourceZone]="s.provenance"><app-social-card [social]="s" /></span>
              }
            </div>
          </app-section>
        }

        @if (p.discourseCount > 0) {
          <app-section title="posts no X sinalizados pela IA" anchor="discurso">
            <p class="hint mb-4">
              Classificação automática por IA — pode errar.
              {{ p.discourseCount > p.discourse.length ? 'Mostrando os ' + p.discourse.length + ' de ' + p.discourseCount + '.' : '' }}
            </p>
            <div class="stack gap-2">
              @for (t of p.discourse; track t.postId) {
                <app-tweet-card [post]="t" [fallbackName]="displayName()" />
              }
            </div>
            @if (p.discourseCount > p.discourse.length) {
              <div class="mt-3">
                <a class="mono-label hover-underline" routerLink="/sinais/discurso" [queryParams]="{ handle: p.discourse[0]?.handle }">
                  ver todos os {{ p.discourseCount }} posts →
                </a>
              </div>
            }
          </app-section>
        }
      }
    </div>
  `,
})
export class PoliticoPage {
  readonly id = input.required<string>();
  readonly ano = input<string>();

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);
  private readonly title = inject(Title);

  protected readonly doc = rxResource({
    params: () => ({ id: intParam(this.id()), ano: intParam(this.ano()) }),
    stream: ({ params }) => this.api.politician(params.id ?? -1, params.ano),
  });

  protected readonly d = computed(() => this.doc.value());
  protected readonly idStr = computed(() => String(intParam(this.id())));
  protected readonly displayName = computed(() => this.d()?.header.person.canonicalName ?? '(nome indisponível)');
  protected readonly cnpjByYear = computed(() => new Map((this.d()?.campaignOrgs ?? []).map((o) => [o.year, o.cnpj])));

  protected readonly toc = computed(() => {
    const p = this.d();
    if (!p) return [];
    const out: { id: string; label: string }[] = [];
    if (p.candidacies.length) out.push({ id: 'candidaturas', label: 'candidaturas' });
    if (p.assets.declaredAssets.length) out.push({ id: 'bens-declarados', label: 'bens' });
    if (p.earmarks.earmarks.length) out.push({ id: 'emendas-parlamentares', label: 'emendas' });
    if (p.donationNetwork.donatedTo.length || p.donationNetwork.receivedFrom.length) out.push({ id: 'rede-de-doacao', label: 'rede' });
    if (p.signals.signals.length) out.push({ id: 'sinais', label: 'sinais' });
    if (p.years.length) out.push({ id: 'financas', label: 'finanças' });
    if (p.socialMedia.length) out.push({ id: 'redes-sociais', label: 'redes sociais' });
    if (p.discourseCount > 0) out.push({ id: 'discurso', label: 'discurso' });
    return out;
  });

  protected readonly brl = formatBRL;
  protected readonly int = formatInt;
  protected readonly cpf = formatCpf;
  protected readonly fmtCnpj = formatCnpj;
  protected readonly roleLabel = signalRoleLabel;

  constructor() {
    effect(() => {
      const name = this.d() ? this.displayName() : '';
      this.shell.setHeader('Consulta', name);
      if (name) this.title.setTitle(`${name} · EloSys`);
    });
  }

  protected toneColor(c: Candidacy): string {
    const t = resultTone(c.result);
    return t === 'green' ? 'var(--green)' : t === 'red' ? 'var(--red)' : 'var(--muted)';
  }

  protected setYear(y: number | null): void {
    patchQuery(this.router, { ano: y });
  }
}
