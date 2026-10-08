import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, SimulationNodeDatum } from 'd3-force';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { ElosysApiService } from '../../core/elosys-api.service';
import { formatBRL } from '../../core/format';
import { ShellService } from '../../core/shell.service';
import { GraphEdge, GraphNodeInfo, GraphNodeKind, GraphSearchResult } from '../../shared/models/api.models';
import { findCircularEdgeKeys } from './graph-cycles';

const WIDTH = 1100;
const HEIGHT = 700;
const MAX_CONNECTORS = 12;
const SIDE_OFFSET = 260;

const NODE_COLOR: Record<GraphNodeKind, { fill: string; stroke: string }> = {
  self: { fill: 'rgba(234,179,8,.16)', stroke: 'var(--gold)' },
  politician: { fill: 'rgba(var(--accent-rgb),.16)', stroke: 'var(--accent)' },
  donor: { fill: 'rgba(34,197,94,.12)', stroke: 'var(--green)' },
  supplier: { fill: 'rgba(var(--accent-2-rgb),.12)', stroke: 'var(--accent-2)' },
  sanctioned: { fill: 'rgba(239,68,68,.14)', stroke: 'var(--red)' },
  company: { fill: 'var(--card-tone)', stroke: 'var(--border-2)' },
  person: { fill: 'var(--card-tone)', stroke: 'var(--muted-2)' },
};

const NODE_KIND_LABEL: Record<GraphNodeKind, string> = {
  self: 'este candidato', politician: 'político', donor: 'doador', supplier: 'fornecedor',
  sanctioned: 'sancionado', company: 'empresa', person: 'pessoa física',
};

interface VNode extends GraphNodeInfo {
  x: number;
  y: number;
  r: number;
  loading: boolean;
}

interface VEdge extends GraphEdge {
  id: string;
  circular: boolean;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
}

function radiusFor(type: 'person' | 'company'): number {
  return type === 'person' ? 27 : 21;
}

function edgeId(e: { source: string; target: string; kind: string }): string {
  return `${e.source}|${e.target}|${e.kind}`;
}

function centsFrom(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Math.round(Number(v.replace(',', '.')) * 100);
  return Number.isNaN(n) ? null : n;
}

@Component({
  selector: 'app-grafo-page',
  styles: `
    :host { display: flex; flex-direction: column; height: calc(100vh - var(--navbar-h, 56px)); min-height: 520px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--border-1); }
    .search { position: relative; width: 100%; max-width: 420px; }
    .search input { width: 100%; box-sizing: border-box; border: 1px solid var(--border-1); background: var(--card-tone); color: var(--fg-1);
                    border-radius: var(--r-sm); padding: 10px 12px; font-family: var(--font-mono); font-size: 12px; outline: none; }
    .search input:focus { border-color: var(--border-2); }
    .results { position: absolute; z-index: 20; margin-top: 6px; width: 100%; max-height: 50vh; overflow-y: auto; border: 1px solid var(--border-1);
               background: var(--card-tone); border-radius: var(--r-sm); box-shadow: var(--shadow-modal); }
    .results button { display: flex; width: 100%; gap: 12px; align-items: center; text-align: left; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--border-1);
                      background: transparent; color: var(--fg-1); cursor: pointer; font-size: 13px; }
    .results button:hover { background: var(--hover); }
    .tag { flex: none; border: 1px solid var(--border-1); border-radius: 3px; padding: 1px 5px; font-family: var(--font-mono); font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    .num-input { width: 92px; border: 1px solid var(--border-1); background: var(--card-tone); color: var(--fg-1); border-radius: var(--r-sm); padding: 6px 8px; font-family: var(--font-mono); font-size: 11px; }
    .canvas { position: relative; flex: 1; min-height: 0; overflow: hidden;
              background-image: radial-gradient(var(--border-1) 1.2px, transparent 1.2px); background-size: 28px 28px; }
    svg.graph { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
    svg.graph.panning { cursor: grabbing; }
    .node { cursor: pointer; }
    .node-label { font-family: var(--font-sans); font-size: 11px; fill: var(--fg-2); pointer-events: none; }
    .edge-label { font-family: var(--font-mono); font-size: 9px; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; pointer-events: none; }
    .circular { stroke-dasharray: 7 5; animation: dash 1s linear infinite; }
    @keyframes dash { to { stroke-dashoffset: -12; } }
    .pulse { animation: pulse 1.1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .35; } }
    .empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
    .panel { position: absolute; top: 16px; right: 16px; width: 288px; border: 1px solid var(--border-1); background: var(--card-tone);
             border-radius: var(--r-sm); padding: 16px; box-shadow: var(--shadow-modal); }
    .panel .edges { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-1); max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
                    font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
    .controls { position: absolute; left: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 4px; }
    .legend { display: flex; flex-wrap: wrap; gap: 16px; padding: 10px 24px; border-top: 1px solid var(--border-1); font-family: var(--font-mono);
              font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted-2); }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; border: 1px solid; margin-right: 6px; vertical-align: -1px; }
    .bar { display: inline-block; width: 16px; height: 2px; margin-right: 6px; vertical-align: 2px; }
  `,
  template: `
    <div class="toolbar">
      <div class="search">
        <input [value]="q()" (input)="onQuery($any($event.target).value)" (focus)="resultsOpen.set(results().length > 0)"
               (blur)="closeResultsSoon()" placeholder="buscar candidato/empresa, ou colar CPF/CNPJ…" autocomplete="off" />
        @if (resultsOpen() && (searching() || results().length)) {
          <div class="results">
            @if (searching() && !results().length) {
              @for (i of [1, 2, 3, 4]; track i) {
                <div style="padding: 10px 12px; border-bottom: 1px solid var(--border-1)"><span class="skeleton" style="width: 70%; height: 12px"></span></div>
              }
            }
            @for (r of results(); track r.cpfCnpj) {
              <button type="button" (mousedown)="addNode(r)">
                <span class="tag">{{ r.type === 'person' ? 'pessoa' : 'empresa' }}</span>
                <span class="truncate flex-1">{{ r.label }}</span>
                @if (r.sublabel) {
                  <span class="mono-label">{{ r.sublabel }}</span>
                }
              </button>
            }
          </div>
        }
      </div>
      <label class="row gap-1" style="cursor: pointer"
             title="Ao adicionar, traz TODOS os vínculos diretos desse nó (doadores, fornecedores, candidatos), não só os que conectam com o que já está na tela.">
        <input type="checkbox" [checked]="expandFull()" (change)="expandFull.set($any($event.target).checked)" style="accent-color: var(--accent)" />
        <span class="mono-label">trazer rede inteira</span>
      </label>
      <div class="row gap-1">
        <span class="mono-label">movimentação</span>
        <input class="num-input" type="number" inputmode="decimal" placeholder="mín. R$" [value]="minReais()" (input)="minReais.set($any($event.target).value)" />
        <span class="text-muted-2">–</span>
        <input class="num-input" type="number" inputmode="decimal" placeholder="máx. R$" [value]="maxReais()" (input)="maxReais.set($any($event.target).value)" />
        @if (filterActive()) {
          <button type="button" class="mono-label link-btn" (click)="minReais.set(''); maxReais.set('')">limpar filtro</button>
        }
      </div>
      <span class="mono-label">
        {{ visibleNodes().length }} {{ visibleNodes().length === 1 ? 'nó' : 'nós' }} · {{ visibleEdges().length }} ligações
        {{ filterActive() ? '(de ' + nodes().length + ' · ' + edges().length + ')' : '' }}
      </span>
      @if (circularCount() > 0) {
        <span class="mono-label text-red">● {{ circularCount() }} em doação circular</span>
      }
      @if (truncatedNotice()) {
        <button type="button" class="mono-label link-btn text-accent" (click)="truncatedNotice.set(null)" title="clique pra dispensar">⚠ {{ truncatedNotice() }}</button>
      }
      @if (nodes().length) {
        <button type="button" class="mono-label link-btn ml-auto" (click)="clearAll()">limpar tudo</button>
      }
    </div>

    <div class="canvas" #canvas>
      @if (!nodes().length) {
        <div class="empty">
          <div style="font-size: 18px; font-weight: 300; color: var(--muted)">Adicione um candidato ou empresa</div>
          <p style="max-width: 28rem; font-size: 13px; line-height: 1.6; color: var(--muted-2); margin: 0">
            Busque acima ou cole um CPF/CNPJ — por padrão, cada busca adiciona só aquele nó, e ao adicionar o próximo o grafo
            traz apenas o caminho de até 2 passos entre eles (ligação direta, ou por um doador/fornecedor/candidato em comum).
            Ligue “trazer rede inteira” se quiser que cada nó adicionado já venha com TODOS os seus vínculos diretos.
          </p>
        </div>
      } @else {
        <svg class="graph" [class.panning]="panning()" (pointerdown)="onPanStart($event)" (pointermove)="onPointerMove($event)"
             (pointerup)="onPointerUp()" (pointerleave)="onPointerUp()" (wheel)="onWheel($event)">
          <defs>
            <marker id="g-arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--green)" /></marker>
            <marker id="g-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent-2)" /></marker>
            <marker id="g-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--red)" /></marker>
            @for (n of visibleNodes(); track n.cpfCnpj) {
              @if (n.photoUrl) {
                <clipPath [attr.id]="'g-clip-' + n.cpfCnpj"><circle [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r - 2" /></clipPath>
              }
            }
          </defs>
          <g [attr.transform]="'translate(' + view().x + ',' + view().y + ') scale(' + view().k + ')'">
            @for (e of drawnEdges(); track e.id) {
              <path [attr.d]="e.d" fill="none" [attr.stroke]="e.color" [attr.stroke-width]="e.width" [attr.opacity]="e.opacity"
                    [class.circular]="e.circular" [attr.marker-end]="e.marker" />
              @if (showEdgeLabels()) {
                <text class="edge-label" [attr.x]="e.lx" [attr.y]="e.ly" text-anchor="middle" [attr.fill]="e.color">{{ e.label }}</text>
              }
            }
            @for (n of visibleNodes(); track n.cpfCnpj) {
              <g class="node" [class.pulse]="n.loading" (pointerdown)="onNodeDown($event, n)" (click)="select(n.cpfCnpj, $event)">
                <circle [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r" [attr.fill]="color(n).fill" [attr.stroke]="color(n).stroke"
                        [attr.stroke-width]="selected() === n.cpfCnpj ? 3.5 : 2" />
                @if (n.photoUrl) {
                  <image [attr.href]="n.photoUrl" [attr.x]="n.x - n.r + 2" [attr.y]="n.y - n.r + 2" [attr.width]="(n.r - 2) * 2" [attr.height]="(n.r - 2) * 2"
                         [attr.clip-path]="'url(#g-clip-' + n.cpfCnpj + ')'" preserveAspectRatio="xMidYMid slice" />
                } @else {
                  <text [attr.x]="n.x" [attr.y]="n.y + 4" text-anchor="middle" font-size="12" [attr.fill]="color(n).stroke" style="pointer-events: none">
                    {{ n.type === 'company' ? '▣' : (n.label.charAt(0) || '?') }}
                  </text>
                }
                @if (n.sanctioned) {
                  <text [attr.x]="n.x + n.r - 4" [attr.y]="n.y - n.r + 8" font-size="12" fill="var(--red)">⚠</text>
                }
                <text class="node-label" [attr.x]="n.x" [attr.y]="n.y + n.r + 14" text-anchor="middle">{{ short(n.label) }}</text>
              </g>
            }
          </g>
        </svg>

        <div class="controls">
          <button type="button" class="btn btn--icon" (click)="zoomBy(1.2)" aria-label="aproximar">+</button>
          <button type="button" class="btn btn--icon" (click)="zoomBy(1 / 1.2)" aria-label="afastar">−</button>
          <button type="button" class="btn btn--icon" (click)="fit()" aria-label="enquadrar">⤢</button>
        </div>
      }

      @if (selectedNode(); as s) {
        <div class="panel" (pointerdown)="$event.stopPropagation()">
          <div class="row gap-2" style="justify-content: space-between; align-items: flex-start">
            <div class="flex-1">
              <div class="mono-label" style="font-size: 8.5px">{{ kindLabel[s.kind] }}</div>
              <div class="mt-1 truncate" style="font-size: 14px">{{ s.label }}</div>
            </div>
            <button type="button" class="link-btn" (click)="selected.set(null)" aria-label="fechar">✕</button>
          </div>
          @if (s.sanctioned) {
            <div class="mono mt-2 text-red" style="font-size: 9.5px">⚠ sanção federal (CEIS/CNEP)</div>
          }
          @if (s.registryStatus) {
            <div class="mono mt-1" style="font-size: 9.5px; color: var(--muted-2)">situação: {{ s.registryStatus }}</div>
          }
          @if (selectedEdges().length) {
            <div class="edges">
              @for (e of selectedEdges(); track e.id) {
                <div [class.text-red]="e.circular">
                  {{ e.source === s.cpfCnpj ? '→' : '←' }} {{ e.kind === 'donation' ? 'doou pra' : 'pagou' }}
                  {{ labelFor(e.source === s.cpfCnpj ? e.target : e.source) }}
                  <span style="color: var(--muted-2)"> · {{ brl(e.amountCents) }}</span>{{ e.circular ? ' ⚠ circular' : '' }}
                </div>
              }
            </div>
          }
          <div class="row gap-2 mt-4">
            <button type="button" class="btn btn--primary flex-1" style="justify-content: center" (click)="openProfile(s)">ver ficha completa</button>
            <button type="button" class="btn" (click)="expandNode(s.cpfCnpj)" title="trazer todos os vínculos diretos">expandir</button>
            <button type="button" class="btn" (click)="removeNode(s.cpfCnpj)">remover</button>
          </div>
        </div>
      }
    </div>

    <div class="legend">
      @for (k of kinds; track k) {
        <span><span class="dot" [style.background]="nodeColor[k].fill" [style.border-color]="nodeColor[k].stroke"></span>{{ kindLabel[k] }}</span>
      }
      <span><span class="bar" style="background: var(--green)"></span>doação</span>
      <span><span class="bar" style="background: var(--accent-2)"></span>pagamento</span>
      <span class="text-red"><span class="bar" style="background: var(--red)"></span>caminho de doação circular</span>
    </div>
  `,
})
export class GrafoPage {
  readonly add = input<string>();

  private readonly api = inject(ElosysApiService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);
  private readonly canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');

  protected readonly nodes = signal<VNode[]>([]);
  protected readonly edges = signal<VEdge[]>([]);
  protected readonly roots = signal<Set<string>>(new Set());
  protected readonly selected = signal<string | null>(null);
  protected readonly q = signal('');
  protected readonly results = signal<GraphSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly resultsOpen = signal(false);
  protected readonly expandFull = signal(false);
  protected readonly minReais = signal('');
  protected readonly maxReais = signal('');
  protected readonly truncatedNotice = signal<string | null>(null);
  protected readonly view = signal({ x: 0, y: 0, k: 1 });
  protected readonly panning = signal(false);

  protected readonly kinds = Object.keys(NODE_COLOR) as GraphNodeKind[];
  protected readonly nodeColor = NODE_COLOR;
  protected readonly kindLabel = NODE_KIND_LABEL;
  protected readonly brl = formatBRL;

  private readonly query$ = new Subject<string>();
  private seeded = false;
  private drag: { mode: 'pan' | 'node'; id?: string; startX: number; startY: number; ox: number; oy: number; moved: boolean } | null = null;

  private readonly minCents = computed(() => centsFrom(this.minReais()));
  private readonly maxCents = computed(() => centsFrom(this.maxReais()));
  protected readonly filterActive = computed(() => this.minCents() != null || this.maxCents() != null);

  protected readonly visibleEdges = computed(() => {
    const min = this.minCents();
    const max = this.maxCents();
    if (min == null && max == null) return this.edges();
    return this.edges().filter((e) => (min == null || e.amountCents >= min) && (max == null || e.amountCents <= max));
  });

  protected readonly visibleNodes = computed(() => {
    if (!this.filterActive()) return this.nodes();
    const keep = new Set(this.roots());
    const sel = this.selected();
    if (sel) keep.add(sel);
    for (const e of this.visibleEdges()) {
      keep.add(e.source);
      keep.add(e.target);
    }
    return this.nodes().filter((n) => keep.has(n.cpfCnpj));
  });

  protected readonly showEdgeLabels = computed(() => this.visibleEdges().length <= 60);

  protected readonly drawnEdges = computed(() => {
    const byId = new Map(this.visibleNodes().map((n) => [n.cpfCnpj, n]));
    const out = [];
    for (const e of this.visibleEdges()) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const bend = e.kind === 'payment' ? 18 : 0;
      const x1 = s.x + ux * s.r;
      const y1 = s.y + uy * s.r;
      const x2 = t.x - ux * (t.r + 4);
      const y2 = t.y - uy * (t.r + 4);
      const mx = (x1 + x2) / 2 - uy * bend;
      const my = (y1 + y2) / 2 + ux * bend;
      const color = e.circular ? 'var(--red)' : e.kind === 'donation' ? 'var(--green)' : 'var(--accent-2)';
      out.push({
        id: e.id,
        d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`,
        color,
        circular: e.circular,
        width: Math.min(2.6, 0.6 + Math.log10(Math.max(1, e.amountCents) / 100) * 0.4),
        opacity: e.circular ? 0.95 : 0.55,
        marker: e.circular ? 'url(#g-arrow-red)' : e.kind === 'donation' ? 'url(#g-arrow-green)' : 'url(#g-arrow-amber)',
        label: formatBRL(e.amountCents),
        lx: mx,
        ly: my - 4,
      });
    }
    return out;
  });

  protected readonly circularCount = computed(() => this.edges().filter((e) => e.circular).length);
  protected readonly selectedNode = computed(() => this.nodes().find((n) => n.cpfCnpj === this.selected()) ?? null);
  protected readonly selectedEdges = computed(() => {
    const s = this.selected();
    return s ? this.edges().filter((e) => e.source === s || e.target === s) : [];
  });

  constructor() {
    effect(() => this.shell.setHeader('EloSys', 'Grafo de correlações'));

    this.query$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        tap((v) => {
          if (v.trim().length >= 2) {
            this.searching.set(true);
            this.resultsOpen.set(true);
          }
        }),
        switchMap((v) =>
          v.trim().length < 2
            ? of({ results: [] as GraphSearchResult[] })
            : this.api.graphSearch(v.trim()).pipe(catchError(() => of({ results: [] as GraphSearchResult[] }))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.results.set(r.results);
        this.searching.set(false);
      });

    effect(() => {
      const raw = this.add();
      if (this.seeded || !raw) return;
      this.seeded = true;
      untracked(() => {
        for (const id of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
          this.addNode({ type: id.length === 14 ? 'company' : 'person', cpfCnpj: id, label: id, sublabel: null }, true);
        }
      });
    });
  }

  protected onQuery(v: string): void {
    this.q.set(v);
    if (v.trim().length < 2) {
      this.results.set([]);
      this.searching.set(false);
    }
    this.query$.next(v);
  }

  protected closeResultsSoon(): void {
    setTimeout(() => this.resultsOpen.set(false), 150);
  }

  protected addNode(r: GraphSearchResult, queued = false): void {
    this.q.set('');
    this.results.set([]);
    this.resultsOpen.set(false);
    this.roots.update((s) => new Set(s).add(r.cpfCnpj));
    if (!this.nodes().some((n) => n.cpfCnpj === r.cpfCnpj)) {
      const info: GraphNodeInfo = {
        cpfCnpj: r.cpfCnpj, type: r.type, kind: r.type === 'person' ? 'person' : 'company', label: r.label,
        sanctioned: false, registryStatus: null, personId: null, photoUrl: null,
      };
      this.layout([info], []);
    }
    this.setLoading(r.cpfCnpj, true);
    const run = async () => {
      const data = await this.safe(this.api.graphNode(r.cpfCnpj));
      if (data?.node) this.layout([data.node], []);
      this.setLoading(r.cpfCnpj, false);
      if (this.expandFull()) await this.expandNode(r.cpfCnpj);
      else await this.findPaths(r.cpfCnpj);
      this.fit();
    };
    this.chain = queued ? this.chain.then(run) : run();
  }

  private chain: Promise<void> = Promise.resolve();

  private async findPaths(newId: string): Promise<void> {
    const existing = this.nodes().map((n) => n.cpfCnpj).filter((id) => id !== newId);
    if (!existing.length) return;
    const onCanvas = new Set(this.nodes().map((n) => n.cpfCnpj));
    const data = await this.safe(this.api.graphPaths(newId, existing));
    if (!data) return;

    const bridges = new Map<string, { bridged: Set<string>; maxAmount: number }>();
    for (const e of data.edges) {
      for (const [a, b] of [[e.source, e.target], [e.target, e.source]] as const) {
        if (onCanvas.has(a)) continue;
        const rec = bridges.get(a) ?? { bridged: new Set<string>(), maxAmount: 0 };
        if (onCanvas.has(b)) rec.bridged.add(b);
        rec.maxAmount = Math.max(rec.maxAmount, e.amountCents);
        bridges.set(a, rec);
      }
    }
    const kept = new Set(
      [...bridges.entries()]
        .sort((x, y) => y[1].bridged.size - x[1].bridged.size || y[1].maxAmount - x[1].maxAmount)
        .slice(0, MAX_CONNECTORS)
        .map(([id]) => id),
    );
    const finalIds = new Set([...onCanvas, ...kept]);
    const infos = data.nodes.filter((n) => kept.has(n.cpfCnpj) || onCanvas.has(n.cpfCnpj));
    const edges = data.edges.filter((e) => finalIds.has(e.source) && finalIds.has(e.target));
    this.layout(infos, edges);
    this.mergeEdges(edges);
  }

  async expandNode(id: string): Promise<void> {
    this.setLoading(id, true);
    const data = await this.safe(this.api.graphExpand(id));
    this.setLoading(id, false);
    if (!data) return;
    this.layout(data.nodes, data.edges);
    this.mergeEdges(data.edges);
    if (data.truncated) {
      const label = data.nodes.find((n) => n.cpfCnpj === id)?.label ?? this.labelFor(id);
      this.truncatedNotice.set(`${label}: mostrando só os 400 maiores vínculos.`);
    }
  }

  private mergeEdges(rows: GraphEdge[]): void {
    const byId = new Map(this.edges().map((e) => [e.id, e]));
    for (const e of rows) {
      const id = edgeId(e);
      if (!byId.has(id)) byId.set(id, { ...e, id, circular: false });
    }
    const all = [...byId.values()];
    const circular = findCircularEdgeKeys(
      this.nodes().map((n) => n.cpfCnpj),
      all.map((e) => ({ source: e.source, target: e.target })),
    );
    this.edges.set(all.map((e) => ({ ...e, circular: circular.has(`${e.source}|${e.target}`) })));
  }

  private layout(newInfos: GraphNodeInfo[], layoutEdges: Array<{ source: string; target: string; kind?: string }>): void {
    const current = this.nodes();
    const existing = new Set(current.map((n) => n.cpfCnpj));
    const infoById = new Map(newInfos.map((n) => [n.cpfCnpj, n]));
    const patched = current.map((n) => {
      const info = infoById.get(n.cpfCnpj);
      return info ? { ...n, ...info, x: n.x, y: n.y, r: n.r, loading: n.loading } : n;
    });
    const brandNew = newInfos.filter((n, i, arr) => !existing.has(n.cpfCnpj) && arr.findIndex((m) => m.cpfCnpj === n.cpfCnpj) === i);
    if (!brandNew.length) {
      this.nodes.set(patched);
      return;
    }

    const politicianX = new Map<string, number>();
    for (const n of patched) if (n.kind === 'politician') politicianX.set(n.cpfCnpj, n.x);
    for (const n of brandNew) if (n.kind === 'politician') politicianX.set(n.cpfCnpj, WIDTH / 2);
    const anchorX = new Map<string, number>();
    for (const e of layoutEdges) {
      if (e.kind === 'donation' && politicianX.has(e.target) && !politicianX.has(e.source)) {
        const px = politicianX.get(e.target)! - SIDE_OFFSET;
        const prev = anchorX.get(e.source);
        anchorX.set(e.source, prev == null ? px : (prev + px) / 2);
      } else if (e.kind === 'payment' && politicianX.has(e.source) && !politicianX.has(e.target)) {
        const px = politicianX.get(e.source)! + SIDE_OFFSET;
        const prev = anchorX.get(e.target);
        anchorX.set(e.target, prev == null ? px : (prev + px) / 2);
      }
    }

    const simNodes: SimNode[] = [
      ...patched.map((n) => ({ id: n.cpfCnpj, x: n.x, y: n.y, fx: n.x, fy: n.y, r: n.r })),
      ...brandNew.map((n) => ({
        id: n.cpfCnpj,
        x: anchorX.get(n.cpfCnpj) ?? WIDTH / 2 + (Math.random() - 0.5) * 200,
        y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
        r: radiusFor(n.type),
      })),
    ];
    const ids = new Set(simNodes.map((n) => n.id));
    const links = layoutEdges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ source: e.source, target: e.target }));
    const sim = forceSimulation<SimNode>(simNodes)
      .force('link', forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(160).strength(0.15))
      .force('charge', forceManyBody<SimNode>().strength(-380))
      .force('collide', forceCollide<SimNode>((d) => d.r + 34))
      .force('x', forceX<SimNode>((d) => anchorX.get(d.id) ?? d.x ?? 0).strength((d) => (anchorX.has(d.id) ? 0.22 : 0)))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();

    const pos = new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
    this.nodes.set([
      ...patched,
      ...brandNew.map((n) => ({ ...n, ...pos.get(n.cpfCnpj)!, r: radiusFor(n.type), loading: false })),
    ]);
  }

  private setLoading(id: string, loading: boolean): void {
    this.nodes.update((ns) => ns.map((n) => (n.cpfCnpj === id ? { ...n, loading } : n)));
  }

  private async safe<T>(obs: Observable<T>): Promise<T | null> {
    try {
      return await firstValueFrom(obs);
    } catch {
      return null;
    }
  }

  protected removeNode(id: string): void {
    this.nodes.update((ns) => ns.filter((n) => n.cpfCnpj !== id));
    this.edges.update((es) => es.filter((e) => e.source !== id && e.target !== id));
    this.roots.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (this.selected() === id) this.selected.set(null);
  }

  protected clearAll(): void {
    this.nodes.set([]);
    this.edges.set([]);
    this.roots.set(new Set());
    this.selected.set(null);
    this.truncatedNotice.set(null);
  }

  protected select(id: string, ev: Event): void {
    ev.stopPropagation();
    if (this.drag?.moved) return;
    this.selected.set(id);
  }

  protected onNodeDown(ev: PointerEvent, n: VNode): void {
    ev.stopPropagation();
    this.drag = { mode: 'node', id: n.cpfCnpj, startX: ev.clientX, startY: ev.clientY, ox: n.x, oy: n.y, moved: false };
  }

  protected onPanStart(ev: PointerEvent): void {
    const v = this.view();
    this.drag = { mode: 'pan', startX: ev.clientX, startY: ev.clientY, ox: v.x, oy: v.y, moved: false };
    this.panning.set(true);
  }

  protected onPointerMove(ev: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = ev.clientX - d.startX;
    const dy = ev.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.mode === 'pan') {
      this.view.update((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    } else if (d.moved) {
      const k = this.view().k;
      this.nodes.update((ns) => ns.map((n) => (n.cpfCnpj === d.id ? { ...n, x: d.ox + dx / k, y: d.oy + dy / k } : n)));
    }
  }

  protected onPointerUp(): void {
    const d = this.drag;
    if (d?.mode === 'pan' && !d.moved) this.selected.set(null);
    this.panning.set(false);
    setTimeout(() => (this.drag = null));
  }

  protected onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const rect = (ev.currentTarget as SVGElement).getBoundingClientRect();
    this.zoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - rect.left, ev.clientY - rect.top);
  }

  protected zoomBy(f: number): void {
    const el = this.canvas()?.nativeElement;
    this.zoomAt(f, (el?.clientWidth ?? WIDTH) / 2, (el?.clientHeight ?? HEIGHT) / 2);
  }

  private zoomAt(f: number, cx: number, cy: number): void {
    this.view.update((v) => {
      const k = Math.min(3, Math.max(0.15, v.k * f));
      const r = k / v.k;
      return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });
  }

  protected fit(): void {
    const ns = this.visibleNodes();
    const el = this.canvas()?.nativeElement;
    if (!ns.length || !el) return;
    const pad = 60;
    const minX = Math.min(...ns.map((n) => n.x - n.r)) - pad;
    const maxX = Math.max(...ns.map((n) => n.x + n.r)) + pad;
    const minY = Math.min(...ns.map((n) => n.y - n.r)) - pad;
    const maxY = Math.max(...ns.map((n) => n.y + n.r + 18)) + pad;
    const w = el.clientWidth || WIDTH;
    const h = el.clientHeight || HEIGHT;
    const k = Math.min(1.4, Math.max(0.15, Math.min(w / (maxX - minX), h / (maxY - minY))));
    this.view.set({ k, x: (w - (maxX - minX) * k) / 2 - minX * k, y: (h - (maxY - minY) * k) / 2 - minY * k });
  }

  protected color(n: VNode): { fill: string; stroke: string } {
    return NODE_COLOR[n.kind] ?? NODE_COLOR.person;
  }

  protected labelFor(id: string): string {
    return this.nodes().find((n) => n.cpfCnpj === id)?.label ?? id;
  }

  protected short(label: string): string {
    return label.length > 26 ? label.slice(0, 25) + '…' : label;
  }

  protected openProfile(n: VNode): void {
    if (n.personId != null) this.router.navigate(['/politico', n.personId]);
    else this.router.navigate([n.cpfCnpj.length === 14 ? '/cnpj' : '/cpf', n.cpfCnpj]);
  }
}
