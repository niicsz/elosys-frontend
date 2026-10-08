import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatCnpj, formatCpf, formatInt } from '../../core/format';
import { intParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { FinanceTableComponent } from '../../shared/components/finance-table.component';
import { SourceZoneDirective } from '../../shared/components/source-zone.directive';
import { EmptyStateComponent, YearSelectComponent } from '../../shared/components/ui.components';

const KIND_LABEL: Record<string, string | undefined> = {
  campaign: 'CNPJ de campanha',
  donor: 'já apareceu como doador',
  supplier: 'já apareceu como fornecedor',
  sanctioned: 'empresa sancionada',
};

@Component({
  selector: 'app-entidade-page',
  imports: [RouterLink, SourceZoneDirective, FinanceTableComponent, EmptyStateComponent, YearSelectComponent],
  styles: `
    .page { max-width: 960px; }
    header { border-bottom: 1px solid var(--border-1); padding-bottom: 32px; }
    h1 { margin: 12px 0 0; font-family: var(--font-mono); font-size: clamp(26px, 4vw, 34px); font-weight: 500; letter-spacing: -.01em; }
    section.block { border-bottom: 1px solid var(--border-1); padding: 40px 0; }
    .info { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px 24px; }
    .info .k { font-family: var(--font-mono); font-size: 8.5px; color: var(--muted-2); text-transform: uppercase; letter-spacing: .06em; }
    .info .v { margin-top: 6px; font-size: 13px; color: var(--fg-2); }
    .line { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 16px; border-bottom: 1px solid var(--border-1); padding: 12px 0; }
    .line:last-child { border-bottom: 0; }
    .meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-2); }
    h2 { margin: 0 0 8px; font-size: 15px; font-weight: 500; }
  `,
  template: `
    <div class="page">
      @if (doc.error()) {
        <app-empty-state title="Documento não encontrado." [hint]="'nenhum registro para ' + doc_()" icon="∅" />
      } @else if (!d()) {
        <div class="py-7">
          <span class="skeleton" style="width: 120px; height: 12px"></span>
          <div class="mt-4"><span class="skeleton" style="width: 300px; height: 32px"></span></div>
          <div class="mt-4"><span class="skeleton" style="width: 220px; height: 16px"></span></div>
        </div>
      } @else {
        @let e = d()!.profile;
        @let year = d()!.year;
        <div class="row wrap gap-3 mb-4" style="justify-content: flex-end">
          <app-year-select [years]="d()!.years" [value]="year" (yearChange)="setYear($event)" />
        </div>

        <header>
          <div class="label">{{ e.isCompany ? 'ficha de CNPJ' : 'ficha de CPF' }}</div>
          <h1>{{ formattedId() }}</h1>
          @if (e.displayName) {
            <div class="mt-2 text-muted" style="font-size: 15px">{{ e.displayName }}</div>
          }
          <div class="row wrap gap-2 mt-4">
            @if (e.companyKind) {
              <span class="badge">{{ kindLabel[e.companyKind] ?? e.companyKind }}</span>
            }
            @if (e.sanctions.length) {
              <span class="badge badge--red">{{ e.sanctions.length }} {{ e.sanctions.length === 1 ? 'sanção federal' : 'sanções federais' }}</span>
            }
            @if (e.registry?.registryStatus; as st) {
              <span class="badge" [class.badge--green]="st === 'ATIVA'">{{ st }}</span>
            }
            @if (e.personId != null) {
              <a class="badge badge--accent" [routerLink]="['/politico', e.personId]">ver ficha de candidato →</a>
            }
          </div>
        </header>

        @if (e.registry; as r) {
          <section class="block">
            <div class="mono-label mb-4">cadastro na Receita Federal</div>
            <div class="info" [appSourceZone]="r.provenance">
              <div><div class="k">aberta em</div><div class="v">{{ r.openedAt ?? 'não disponível' }}</div></div>
              <div><div class="k">natureza jurídica</div><div class="v">{{ r.legalNature ?? 'n/d' }}</div></div>
              <div><div class="k">capital social</div><div class="v">{{ r.shareCapitalCents != null ? brl(r.shareCapitalCents) : 'n/d' }}</div></div>
              <div><div class="k">porte</div><div class="v">{{ r.size ?? 'n/d' }}</div></div>
              <div><div class="k">atividade principal</div><div class="v">{{ r.primaryCnae ?? 'n/d' }}</div></div>
              <div><div class="k">localização</div><div class="v">{{ r.city && r.state ? r.city + '/' + r.state : 'n/d' }}</div></div>
            </div>

            @if (e.partners.length) {
              <div class="mt-8">
                <div class="mono-label mb-4">quadro societário</div>
                <p class="hint mb-4" style="max-width: 36rem">
                  CPF do sócio vem mascarado pela própria fonte — não é possível cruzar com candidatos de forma automática,
                  só conferir o nome manualmente.
                </p>
                @for (p of e.partners; track p.id) {
                  <div class="line">
                    <span style="font-size: 13px">{{ p.partnerName }}</span>
                    <span class="meta">{{ p.role ?? 'papel n/d' }}{{ p.entryDate ? ' · desde ' + p.entryDate : '' }}</span>
                  </div>
                }
              </div>
            }
          </section>
        }

        @if (e.sanctions.length) {
          <section class="block">
            <div class="label mb-2 text-red">sanções federais</div>
            <p class="hint mb-6" style="max-width: 36rem">
              CEIS/CNEP (Portal da Transparência, CGU) — impedimento de contratar com o governo e/ou multa por corrupção
              (Lei 8.429/1992, Lei 12.846/2013).
            </p>
            @for (s of e.sanctions; track s.id) {
              <div class="line" style="display: block; padding: 16px 0" [appSourceZone]="s.provenance">
                <div class="row wrap gap-3" style="justify-content: space-between">
                  <div class="row gap-2">
                    <span class="badge badge--red">{{ s.registry }}</span>
                    <span style="font-size: 13px; color: var(--fg-2)">{{ s.category ?? 'categoria n/d' }}</span>
                  </div>
                  @if (s.fineAmountCents) {
                    <span class="mono text-red" style="font-size: 13px">{{ brl(s.fineAmountCents) }}</span>
                  }
                </div>
                <div class="meta mt-2">
                  {{ s.sanctioningAgency ?? 'órgão n/d' }} · {{ s.agencySphere ?? '—' }}{{ s.startDate ? ' · desde ' + s.startDate : '' }}{{ s.endDate ? ' até ' + s.endDate : '' }}
                </div>
              </div>
            }
          </section>
        }

        @if (d()!.companyEarmarks; as ce) {
          @if (ce.earmarks.length) {
            <section class="block">
              <div class="mono-label mb-2">Portal da Transparência · emendas parlamentares</div>
              <h2>emendas recebidas · {{ brl(ce.totalCents) }} em {{ int(ce.earmarks.length) }} emendas</h2>
              <p class="hint mb-6" style="max-width: 36rem">
                Verbas do orçamento federal destinadas a esta empresa via emenda. O autor é identificado só por nome (a fonte
                não tem CPF do autor) — um cruzamento provável, não uma identidade confirmada.
              </p>
              <div class="table-wrap">
                <div class="scroll-x">
                  <table class="table" style="min-width: 640px">
                    <thead><tr><th>autor da emenda</th><th>localidade</th><th class="right">valor recebido</th></tr></thead>
                    <tbody>
                      @for (m of ce.earmarks; track m.earmarkCode) {
                        <tr>
                          <td>
                            @if (m.authorPersonId != null) {
                              <a class="link-primary" [routerLink]="['/politico', m.authorPersonId]">{{ m.authorName ?? 'autor não identificado' }}</a>
                            } @else {
                              {{ m.authorName ?? 'autor não identificado' }}
                            }
                            @if (m.earmarkYear) {
                              <div class="sub">{{ m.earmarkYear }}</div>
                            }
                          </td>
                          <td style="font-size: 12px; color: var(--muted)">{{ m.municipality && m.state ? m.municipality + '/' + m.state : (m.state ?? '—') }}</td>
                          <td class="num">{{ brl(m.amountCents) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          }
        }

        @if (e.donationsGivenTotal.count > 0) {
          <app-finance-table
            [title]="'pra quem já doou · ' + brl(e.donationsGivenTotal.totalCents) + ' em ' + int(e.donationsGivenTotal.count) + ' doações'"
            scope="entity" [entityId]="e.cpfCnpj" dir="given" counterpartyLabel="candidato" tone="green" [year]="year" />
        }
        @if (e.paymentsReceivedTotal.count > 0) {
          <app-finance-table
            [title]="'de quem já recebeu dinheiro · ' + brl(e.paymentsReceivedTotal.totalCents) + ' em ' + int(e.paymentsReceivedTotal.count) + ' pagamentos'"
            scope="entity" [entityId]="e.cpfCnpj" dir="received" counterpartyLabel="candidato" tone="neutral" [year]="year" />
        }
        @if (year && e.donationsGivenTotal.count === 0 && e.paymentsReceivedTotal.count === 0) {
          <div style="padding-top: 16px">
            <app-empty-state [title]="'Nenhuma doação ou pagamento registrado em ' + year + '.'" [compact]="true" />
          </div>
        }
      }
    </div>
  `,
})
export class EntidadePage {
  readonly doc_ = input.required<string>({ alias: 'doc' });
  readonly ano = input<string>();

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);
  private readonly title = inject(Title);

  protected readonly doc = rxResource({
    params: () => ({ doc: (this.doc_() ?? '').replace(/\D/g, ''), ano: intParam(this.ano()) }),
    stream: ({ params }) => this.api.entity(params.doc, params.ano),
  });

  protected readonly d = computed(() => (this.doc.value()?.redirectPersonId != null ? undefined : this.doc.value()));
  protected readonly formattedId = computed(() => {
    const p = this.d()?.profile;
    if (!p) return '';
    return p.isCompany ? formatCnpj(p.cpfCnpj) : formatCpf(p.cpfCnpj);
  });

  protected readonly kindLabel = KIND_LABEL;
  protected readonly brl = formatBRL;
  protected readonly int = formatInt;

  constructor() {
    effect(() => {
      const redirect = this.doc.value()?.redirectPersonId;
      if (redirect != null) this.router.navigate(['/politico', redirect], { replaceUrl: true });
    });
    effect(() => {
      const p = this.d()?.profile;
      const current = p ? (p.displayName ?? this.formattedId()) : '';
      this.shell.setHeader(p?.isCompany ?? this.doc_().length === 14 ? 'Ficha de CNPJ' : 'Ficha de CPF', current);
      if (current) this.title.setTitle(`${current} · EloSys`);
    });
  }

  protected setYear(y: number | null): void {
    patchQuery(this.router, { ano: y });
  }
}
