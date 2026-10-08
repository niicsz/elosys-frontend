import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL, formatCnpj, formatInt } from '../../core/format';
import { pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  PaginationComponent,
  SearchInputComponent,
} from '../../shared/components/ui.components';

@Component({
  selector: 'app-emendas-page',
  imports: [RouterLink, AvatarComponent, EmptyStateComponent, PaginationComponent, SearchInputComponent],
  styles: `.meta { font-family: var(--font-mono); font-size: 9.5px; color: var(--muted-2); }`,
  template: `
    <div class="page stack gap-8">
      <section>
        <h1 class="page-title" style="margin: 0">Emendas parlamentares — quem fez, quanto, pra qual empresa</h1>
        <p class="lead">
          Toda emenda ao orçamento federal (2014-atual) cujo favorecido é uma empresa (pessoa jurídica) — não um município,
          órgão público ou pessoa física. O autor é identificado só por <strong>nome</strong>, não por CPF (a fonte não tem esse
          vínculo): é um cruzamento provável, não uma identidade confirmada.
        </p>
        <div class="mono mt-6" style="font-size: 11px; color: var(--muted)">
          <span style="color: var(--fg-1)">{{ int(data.value()?.total ?? 0) }}</span> emendas pra empresas
        </div>
        <div class="mt-5">
          <app-search-input [value]="q()" placeholder="buscar autor ou empresa…" (search)="nav({ q: $event })" />
        </div>
      </section>

      <section>
        @if (data.isLoading() && !data.value()) {
          <div class="table-wrap" style="padding: 16px">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div class="skeleton mb-3" style="height: 14px; width: 100%"></div>
            }
          </div>
        } @else if (!rows().length) {
          <app-empty-state [title]="q() ? 'nada para essa busca.' : 'nenhuma emenda pra empresa encontrada.'" />
        } @else {
          <div class="table-wrap">
            <div class="scroll-x">
              <table class="table" style="min-width: 680px">
                <thead><tr><th>autor da emenda</th><th>empresa</th><th class="right">valor</th></tr></thead>
                <tbody [class.loading-rows]="data.isLoading()">
                  @for (r of rows(); track r.earmarkCode + '-' + r.companyCnpj) {
                    <tr>
                      <td>
                        <div class="row gap-2">
                          @if (r.authorPersonId != null) {
                            <app-avatar [photoUrl]="r.authorPhotoUrl" [name]="r.authorName ?? '?'" />
                          }
                          <div>
                            @if (r.authorPersonId != null) {
                              <a class="hover-underline" [routerLink]="['/politico', r.authorPersonId]">{{ r.authorName ?? 'autor não identificado' }}</a>
                            } @else {
                              <span>{{ r.authorName ?? 'autor não identificado' }}</span>
                            }
                            @if (r.year) {
                              <div class="meta">{{ r.year }}</div>
                            }
                          </div>
                        </div>
                      </td>
                      <td style="max-width: 240px">
                        <a class="hover-underline" [routerLink]="['/cnpj', r.companyCnpj]">{{ r.companyName ?? cnpj(r.companyCnpj) }}</a>
                        <div class="meta">{{ cnpj(r.companyCnpj) }}</div>
                      </td>
                      <td class="num">{{ brl(r.amountCents) }}</td>
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
export class EmendasPage {
  readonly q = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);

  protected readonly page = computed(() => pageParam(this.pageQ()));
  protected readonly data = rxResource({
    params: () => ({ q: this.q() ?? '', page: this.page(), order: 'desc' }),
    stream: ({ params }) => this.api.earmarks(params),
  });
  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly totalPages = computed(() => {
    const d = this.data.value();
    return d ? Math.max(1, Math.ceil(d.total / (d.pageSize || 25))) : 1;
  });

  protected readonly brl = formatBRL;
  protected readonly cnpj = formatCnpj;
  protected readonly int = formatInt;

  constructor() {
    effect(() => this.shell.setHeader('EloSys', 'Emendas Parlamentares'));
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
