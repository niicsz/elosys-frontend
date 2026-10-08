import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatBRL } from '../../core/format';
import { DonationNetwork, NetworkBranch, NetworkNode } from '../../shared/models/api.models';

const CENTER_R = 30;
const NODE_R = 18;
const ROW = 64;
const MIN_BAND = ROW + 6;
const PAD_Y = 24;
const WIDTH = 1040;

interface PlacedNode {
  key: string;
  personId: number | null;
  label: string;
  photoUrl: string | null;
  x: number;
  y: number;
  r: number;
  circular: boolean;
  center: boolean;
}

interface PlacedEdge {
  key: string;
  d: string;
  color: string;
  width: number;
  opacity: number;
  dashed: boolean;
  label: string | null;
  lx: number;
  ly: number;
}

@Component({
  selector: 'app-politician-network',
  imports: [RouterLink],
  styles: `
    .wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border-1); border-radius: var(--r-sm);
            background-image: radial-gradient(var(--border-1) 1px, transparent 1px); background-size: 26px 26px; }
    svg { display: block; min-width: 720px; width: 100%; }
    .lbl { font-family: var(--font-sans); font-size: 11px; fill: var(--fg-2); }
    .amt { font-family: var(--font-mono); font-size: 9.5px; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; }
    .legend { font-family: var(--font-mono); font-size: 10px; color: var(--muted-2); }
    a.node circle.ring { transition: stroke .15s; }
    a.node:hover circle.ring { stroke: var(--accent-2); }
  `,
  template: `
    <div class="row wrap gap-4 mb-3 legend">
      <span><span style="color: var(--green)">━</span> doou para {{ centerLabel() }}</span>
      <span><span style="color: var(--accent-2)">━</span> recebeu de {{ centerLabel() }}</span>
      @if (layout().hasCircular) {
        <span><span style="color: var(--red)">┅</span> doação nos dois sentidos</span>
      }
    </div>
    <div class="wrap">
      <svg [attr.viewBox]="'0 0 ' + WIDTH + ' ' + layout().height" [style.height.px]="layout().height" role="img" aria-label="rede de doação">
        <defs>
          <marker id="net-arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--green)" /></marker>
          <marker id="net-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent-2)" /></marker>
          <marker id="net-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--red)" /></marker>
          @for (n of layout().nodes; track n.key) {
            @if (n.photoUrl) {
              <clipPath [attr.id]="'net-clip-' + n.key"><circle [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r" /></clipPath>
            }
          }
        </defs>

        @for (e of layout().edges; track e.key) {
          <path [attr.d]="e.d" fill="none" [attr.stroke]="e.color" [attr.stroke-width]="e.width" [attr.opacity]="e.opacity"
                [attr.stroke-dasharray]="e.dashed ? '7 5' : null" [attr.marker-end]="marker(e.color)" />
          @if (e.label) {
            <text class="amt" [attr.x]="e.lx" [attr.y]="e.ly" text-anchor="middle" [attr.fill]="e.color">{{ e.label }}</text>
          }
        }

        @for (n of layout().nodes; track n.key) {
          <a class="node" [routerLink]="n.center ? null : ['/politico', n.personId]">
            <circle class="ring" [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r" fill="var(--active)"
                    [attr.stroke]="n.center ? 'var(--accent-2)' : n.circular ? 'var(--red)' : 'var(--border-2)'"
                    [attr.stroke-width]="n.center || n.circular ? 2.5 : 1.2" />
            @if (n.photoUrl) {
              <image [attr.href]="n.photoUrl" [attr.x]="n.x - n.r" [attr.y]="n.y - n.r" [attr.width]="n.r * 2" [attr.height]="n.r * 2"
                     [attr.clip-path]="'url(#net-clip-' + n.key + ')'" preserveAspectRatio="xMidYMid slice" />
            } @else {
              <text [attr.x]="n.x" [attr.y]="n.y + 4" text-anchor="middle" font-size="12" fill="var(--muted)">{{ n.label.charAt(0) }}</text>
            }
            <text class="lbl" [attr.x]="n.x" [attr.y]="n.y + n.r + 13" text-anchor="middle">{{ short(n.label) }}</text>
          </a>
        }
      </svg>
    </div>
  `,
})
export class PoliticianNetworkComponent {
  readonly network = input.required<DonationNetwork>();
  readonly centerLabel = input.required<string>();
  readonly centerPhotoUrl = input<string | null>(null);

  protected readonly WIDTH = WIDTH;

  protected readonly layout = computed(() => {
    const { donatedTo, receivedFrom } = this.network();
    const band = (b: NetworkBranch) => Math.max(MIN_BAND, b.children.length * ROW);
    const sideH = (bs: NetworkBranch[]) => bs.reduce((a, b) => a + band(b), 0);
    const inner = Math.max(sideH(receivedFrom), sideH(donatedTo), MIN_BAND);
    const height = inner + PAD_Y * 2;

    const leftIds = new Set(receivedFrom.map((b) => b.node.personId));
    const circular = new Set(donatedTo.map((b) => b.node.personId).filter((id) => leftIds.has(id)));

    const nodes = new Map<string, PlacedNode>();
    const edges: PlacedEdge[] = [];
    const center: PlacedNode = {
      key: 'center', personId: null, label: this.centerLabel(), photoUrl: this.centerPhotoUrl(),
      x: WIDTH / 2, y: height / 2, r: CENTER_R, circular: false, center: true,
    };
    nodes.set(center.key, center);

    const place = (n: NetworkNode, x: number, y: number): PlacedNode => {
      const key = `p${n.personId}`;
      const existing = nodes.get(key);
      if (existing) return existing;
      const p: PlacedNode = {
        key, personId: n.personId, label: n.label, photoUrl: n.photoUrl, x, y, r: NODE_R,
        circular: circular.has(n.personId), center: false,
      };
      nodes.set(key, p);
      return p;
    };

    const link = (from: PlacedNode, to: PlacedNode, amount: number, dir: 'in' | 'out', faint: boolean) => {
      const key = `${from.key}->${to.key}`;
      if (edges.some((e) => e.key === key)) return;
      const isCircular = from.circular || to.circular;
      const color = isCircular ? 'var(--red)' : dir === 'in' ? 'var(--green)' : 'var(--accent-2)';
      const w = Math.min(2.6, 0.6 + Math.log10(Math.max(1, amount) / 100) * 0.4);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const x1 = from.x + (dx / len) * (from.r + 2);
      const y1 = from.y + (dy / len) * (from.r + 2);
      const x2 = to.x - (dx / len) * (to.r + 5);
      const y2 = to.y - (dy / len) * (to.r + 5);
      const cx = (x1 + x2) / 2;
      edges.push({
        key,
        d: `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`,
        color,
        width: faint ? Math.min(w, 1.4) : w,
        opacity: isCircular ? 0.95 : faint ? 0.45 : 0.75,
        dashed: isCircular,
        label: faint ? null : formatBRL(amount),
        lx: cx,
        ly: (y1 + y2) / 2 - 5,
      });
    };

    const side = (branches: NetworkBranch[], x1: number, x2: number, dir: 'in' | 'out') => {
      let cursor = PAD_Y + (inner - sideH(branches)) / 2;
      for (const b of branches) {
        const h = band(b);
        const parent = place(b.node, x1, cursor + h / 2);
        if (dir === 'in') link(parent, center, b.node.amountCents, dir, false);
        else link(center, parent, b.node.amountCents, dir, false);
        const start = cursor + (h - b.children.length * ROW) / 2 + ROW / 2;
        b.children.forEach((c, j) => {
          const child = place(c, x2, start + j * ROW);
          if (dir === 'in') link(child, parent, c.amountCents, dir, true);
          else link(parent, child, c.amountCents, dir, true);
        });
        cursor += h;
      }
    };

    side(receivedFrom, WIDTH * 0.28, 70, 'in');
    side(donatedTo, WIDTH * 0.72, WIDTH - 70, 'out');

    return { nodes: [...nodes.values()], edges, height, hasCircular: circular.size > 0 };
  });

  protected marker(color: string): string {
    return color === 'var(--red)' ? 'url(#net-arrow-red)' : color === 'var(--green)' ? 'url(#net-arrow-green)' : 'url(#net-arrow-amber)';
  }

  protected short(label: string): string {
    return label.length > 24 ? label.slice(0, 23) + '…' : label;
  }
}
