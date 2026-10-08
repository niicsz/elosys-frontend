import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatInt, formatShortDate, SEVERITY_LABEL, severityBadge } from '../../core/format';
import { pageParam, patchQuery } from '../../core/query';
import { ShellService } from '../../core/shell.service';
import { EmptyStateComponent, PaginationComponent, SearchInputComponent } from '../../shared/components/ui.components';

const GROUP_CATEGORIES = [
  'lgbtfobia', 'racismo', 'misoginia', 'capacitismo', 'xenofobia', 'regionalismo', 'aporofobia', 'gordofobia',
  'antissemitismo', 'intolerancia_religiosa', 'etarismo_saude',
];
const OTHER_CATEGORIES = ['desumanizacao', 'xingamento_pessoal'];
const ALL_CATEGORIES = [...GROUP_CATEGORIES, ...OTHER_CATEGORIES];
const CATEGORY_LABEL: Record<string, string | undefined> = {
  lgbtfobia: 'LGBTfobia', racismo: 'racismo', misoginia: 'misoginia', capacitismo: 'capacitismo', xenofobia: 'xenofobia',
  regionalismo: 'regionalismo', aporofobia: 'aporofobia', gordofobia: 'gordofobia', antissemitismo: 'antissemitismo',
  intolerancia_religiosa: 'intolerância religiosa', etarismo_saude: 'etarismo / saúde', desumanizacao: 'desumanização',
  xingamento_pessoal: 'xingamento pessoal',
};
const SEVERITIES = ['high', 'medium', 'low'];

@Component({
  selector: 'app-discurso-page',
  imports: [RouterLink, EmptyStateComponent, PaginationComponent, SearchInputComponent],
  styles: `
    .summary { font-family: var(--font-mono); font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 8px 24px; }
    blockquote { margin: 12px 0 0; border-left: 2px solid var(--border-1); padding-left: 12px; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; color: var(--fg-2); }
    .who { font-size: 12px; }
    .meta { font-family: var(--font-mono); font-size: 11px; color: var(--muted-2); }
    .pager { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border-1); display: flex; justify-content: center; }
  `,
  template: `
    <div class="page stack gap-8">
      <section>
        <h1 class="page-title" style="margin: 0">Discurso pejorativo em posts públicos</h1>
        <p class="lead">
          Posts e respostas de contas de X <strong>declaradas pelo próprio candidato ao TSE</strong>, filtrados por um léxico de
          ~470 termos que <em>podem</em> ser pejorativos e depois lidos por um modelo (Claude Haiku) que decide, pelo contexto,
          se aquilo ataca um grupo protegido ou uma pessoa — ou se é uso legítimo (citação, denúncia, palavra literal).
          <strong>Classificação automática, pode errar</strong> — o trecho literal e o link pro tweet estão sempre à vista.
          Indício, não prova.
        </p>

        @if (summary(); as s) {
          @if (s.total > 0) {
            <div class="summary mt-6">
              <span><span style="color: var(--fg-1)">{{ int(s.reviewed) }}</span> posts revisados</span>
              <span><span style="color: var(--accent-2)">{{ int(s.total) }}</span> sinalizados</span>
              <span><span style="color: var(--fg-1)">{{ int(s.accounts) }}</span> contas</span>
              @for (sv of severities; track sv) {
                @if (s.bySeverity[sv]) {
                  <span>{{ s.bySeverity[sv] }} {{ sevLabel[sv] }}</span>
                }
              }
            </div>
          }
        }

        <div class="row wrap gap-2 mt-5">
          <button type="button" class="btn" [class.btn--primary]="!cat() && !grupoAtivo()" (click)="nav({ categoria: null, grupo: null })">
            todos ({{ summary()?.total ?? 0 }})
          </button>
          <button type="button" class="btn" [class.btn--primary]="grupoAtivo()" (click)="nav({ categoria: null, grupo: '1' })">
            só grupo protegido ({{ groupTotal() }})
          </button>
          <span class="divider-v"></span>
          @for (c of categories; track c) {
            @if (summary()?.byCategory?.[c]) {
              <button type="button" class="btn" [class.btn--primary]="cat() === c" (click)="nav({ categoria: c, grupo: null })">
                {{ catLabel[c] }} ({{ summary()!.byCategory[c] }})
              </button>
            }
          }
        </div>

        <div class="row wrap gap-2 mt-4">
          <app-search-input [value]="q()" placeholder="buscar por texto, nome ou @" [width]="256" (search)="nav({ q: $event })" />
          <select class="select" [value]="sev() ?? ''" (change)="nav({ severidade: $any($event.target).value || null })" aria-label="severidade">
            <option value="">toda severidade</option>
            @for (sv of severities; track sv) {
              <option [value]="sv" [selected]="sev() === sv">{{ sevLabel[sv] }}</option>
            }
          </select>
          @if (handle()) {
            <span class="badge">&#64;{{ handle() }}
              <button type="button" class="link-btn" style="margin-left: 6px" (click)="nav({ handle: null })" aria-label="remover filtro de conta">×</button>
            </span>
          }
        </div>
      </section>

      <section>
        @if (data.isLoading() && !data.value()) {
          @for (i of [1, 2, 3]; track i) {
            <div class="signal mb-3"><span class="skeleton" style="width: 60%; height: 14px"></span></div>
          }
        } @else if (summary()?.reviewed === 0) {
          <app-empty-state title="nenhum post revisado ainda" hint="rode os jobs social-x e social-review (precisam de APIFY_TOKEN e ANTHROPIC_API_KEY)" />
        } @else if (!rows().length) {
          <app-empty-state title="nenhum sinal para esse filtro." />
        } @else {
          <div class="stack gap-3" [class.loading-rows]="data.isLoading()">
            @for (s of rows(); track s.postId) {
              <article [class]="'signal' + (s.severity ? ' signal--' + s.severity : '')">
                <div class="row wrap gap-3" style="justify-content: space-between">
                  <div class="row wrap gap-3">
                    @if (s.severity) {
                      <span [class]="'badge ' + sevBadge(s.severity)">severidade {{ sevLabel[s.severity] }}</span>
                    }
                    @for (c of s.categories; track c) {
                      <span class="badge">{{ catLabel[c] ?? c }}</span>
                    }
                    <span class="mono-label">{{ s.kind }}</span>
                  </div>
                  <div class="row gap-3">
                    <span class="mono-label">{{ date(s.postedAt) }}</span>
                    @if (s.url) {
                      <a class="mono-label hover-underline" [href]="s.url" target="_blank" rel="noopener noreferrer">tweet ↗</a>
                    }
                  </div>
                </div>

                <div class="row wrap gap-2 mt-3 who">
                  @if (s.personId) {
                    <a [routerLink]="['/politico', s.personId]" style="color: var(--fg-2)" class="hover-underline">{{ s.personName ?? '@' + s.handle }}</a>
                  } @else {
                    <span style="color: var(--fg-2)">{{ s.personName ?? '@' + s.handle }}</span>
                  }
                  <span class="meta">&#64;{{ s.handle }}{{ s.party ? ' · ' + s.party : '' }}{{ s.state ? '/' + s.state : '' }}</span>
                  @if (s.replyToHandle) {
                    <span class="meta">resposta a &#64;{{ s.replyToHandle }}</span>
                  }
                </div>

                <blockquote>{{ s.text }}</blockquote>

                @if (s.quote) {
                  <p class="mt-3" style="font-size: 12px; color: var(--muted)">
                    <span class="text-muted-2">trecho apontado: </span><span style="color: var(--accent-2)">“{{ s.quote }}”</span>
                  </p>
                }
                @if (s.explanation) {
                  <p class="mt-2" style="font-size: 12px; line-height: 1.6; color: var(--muted)">{{ s.explanation }}</p>
                }
                @if (s.matchedTerms.length) {
                  <p class="mt-2 mono" style="font-size: 10px; color: var(--muted-2)">termos do filtro: {{ s.matchedTerms.join(', ') }}</p>
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
export class DiscursoPage {
  readonly categoria = input<string>();
  readonly grupo = input<string>();
  readonly severidade = input<string>();
  readonly handle = input<string>();
  readonly q = input<string>();
  readonly pageQ = input<string>(undefined, { alias: 'page' });

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);

  protected readonly categories = ALL_CATEGORIES;
  protected readonly severities = SEVERITIES;
  protected readonly catLabel = CATEGORY_LABEL;
  protected readonly sevLabel = SEVERITY_LABEL;
  protected readonly sevBadge = severityBadge;
  protected readonly int = formatInt;
  protected readonly date = formatShortDate;

  protected readonly cat = computed(() => (ALL_CATEGORIES.includes(this.categoria() ?? '') ? this.categoria()! : null));
  protected readonly grupoAtivo = computed(() => this.grupo() === '1' && !this.cat());
  protected readonly sev = computed(() => (SEVERITIES.includes(this.severidade() ?? '') ? this.severidade()! : null));
  protected readonly page = computed(() => pageParam(this.pageQ()));

  protected readonly data = rxResource({
    params: () => ({
      categoria: this.cat(),
      grupo: this.grupoAtivo() ? '1' : null,
      severidade: this.sev(),
      handle: this.handle() ?? null,
      q: this.q() ?? '',
      page: this.page(),
    }),
    stream: ({ params }) => this.api.discourse(params),
  });

  protected readonly summary = computed(() => this.data.value()?.summary ?? null);
  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly groupTotal = computed(() =>
    GROUP_CATEGORIES.reduce((s, c) => s + (this.summary()?.byCategory[c] ?? 0), 0),
  );
  protected readonly totalPages = computed(() => {
    const d = this.data.value();
    return d ? Math.max(1, Math.ceil(d.total / (d.pageSize || 25))) : 1;
  });

  constructor() {
    effect(() => this.shell.setHeader('Sinais', 'Discurso em rede social'));
  }

  protected nav(patch: Record<string, string | number | null>): void {
    patchQuery(this.router, patch);
  }
}
