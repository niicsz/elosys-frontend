import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatBRL, formatShortDate, SEVERITY_LABEL, severityBadge, VERDICT_LABEL, verdictBadge } from '../../core/format';
import { AiReviewBrief, CycleNode, DiscourseSignal, Signal, SocialMediaLink } from '../models/api.models';

const PLATFORM_COLOR: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E4405F', x: 'var(--fg-1)', youtube: '#FF0000', tiktok: '#FE2C55',
  linkedin: '#0A66C2', whatsapp: '#25D366', telegram: '#26A5E4', kwai: '#FF6600', website: 'var(--muted)', other: 'var(--muted)',
};
const PLATFORM_GLYPH: Record<string, string> = {
  facebook: 'f', instagram: '◎', x: '𝕏', youtube: '▶', tiktok: '♪', linkedin: 'in',
  whatsapp: '✆', telegram: '✈', kwai: 'K', website: '⌂', other: '🔗',
};
const HANDLE_PLATFORMS = new Set(['facebook', 'instagram', 'x', 'youtube', 'tiktok', 'linkedin', 'telegram', 'kwai']);

@Component({
  selector: 'app-social-card',
  styles: `.glyph { width: 22px; text-align: center; font-weight: 700; font-size: 17px; }`,
  template: `
    <a [href]="social().url" target="_blank" rel="noreferrer" class="social-card">
      <span class="social-card__icon glyph" [style.color]="color()">{{ glyph() }}</span>
      <div class="flex-1">
        <div class="social-card__label">{{ label() }}</div>
        <div class="social-card__year">declarado em {{ social().year }}</div>
      </div>
    </a>
  `,
})
export class SocialCardComponent {
  readonly social = input.required<SocialMediaLink>();
  protected readonly color = computed(() => PLATFORM_COLOR[this.social().platform] ?? 'var(--muted)');
  protected readonly glyph = computed(() => PLATFORM_GLYPH[this.social().platform] ?? '🔗');
  protected readonly label = computed(() => {
    const { platform, url } = this.social();
    try {
      const u = new URL(url);
      const segment = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop();
      if (segment && HANDLE_PLATFORMS.has(platform)) return `@${decodeURIComponent(segment)}`;
      return u.hostname.replace(/^www\./, '') + (segment ? `/${decodeURIComponent(segment)}` : '');
    } catch {
      return url;
    }
  });
}

@Component({
  selector: 'app-tweet-card',
  template: `
    <a [attr.href]="post().url" target="_blank" rel="noreferrer" class="tweet-card">
      <div class="tweet-card__avatar">{{ initial() }}</div>
      <div class="tweet-card__main">
        <div class="tweet-card__head">
          <span class="tweet-card__name">{{ name() }}</span>
          <span class="tweet-card__handle">&#64;{{ post().handle }}</span>
          <span class="tweet-card__dot">·</span>
          <span class="tweet-card__date">{{ date() }}</span>
          @if (post().severity; as s) {
            <span class="badge" [class]="'badge ' + sevBadge(s)" style="margin-left: auto">{{ sevLabel[s] ?? s }}</span>
          }
        </div>
        @if (post().replyToHandle) {
          <div class="tweet-card__reply">Respondendo a &#64;{{ post().replyToHandle }}</div>
        }
        <p class="tweet-card__text">{{ post().text }}</p>
        @if (post().explanation) {
          <p class="ai-note"><span class="mono-label">IA</span> {{ post().explanation }}</p>
        }
        @if (post().categories.length) {
          <div class="tweet-card__tags">
            @for (c of post().categories; track c) {
              <span class="badge">{{ c }}</span>
            }
          </div>
        }
      </div>
    </a>
  `,
})
export class TweetCardComponent {
  readonly post = input.required<DiscourseSignal>();
  readonly fallbackName = input('');
  protected readonly name = computed(() => this.post().personName ?? this.fallbackName());
  protected readonly initial = computed(() => (this.name() || this.post().handle || '?').trim().charAt(0).toUpperCase());
  protected readonly date = computed(() => formatShortDate(this.post().postedAt));
  protected readonly sevBadge = severityBadge;
  protected readonly sevLabel = SEVERITY_LABEL;
}

@Component({
  selector: 'app-ai-badge',
  template: `<span [class]="'badge ' + badge()">IA: {{ label() }}</span>`,
})
export class AiBadgeComponent {
  readonly review = input.required<AiReviewBrief | { verdict: string }>();
  protected readonly badge = computed(() => verdictBadge(this.review().verdict));
  protected readonly label = computed(() => VERDICT_LABEL[this.review().verdict] ?? this.review().verdict);
}

interface RingNode {
  node: CycleNode;
  x: number;
  y: number;
  self: boolean;
  link: string[];
}

interface RingEdge {
  d: string;
  lx: number;
  ly: number;
  amount: number;
}

const NODE_R = 20;

@Component({
  selector: 'app-cycle-graph',
  imports: [RouterLink, AiBadgeComponent],
  styles: `
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .node-label { font-family: var(--font-sans); font-size: 10px; fill: var(--fg-2); }
    .edge-label { font-family: var(--font-mono); font-size: 9.5px; fill: var(--red); paint-order: stroke; stroke: var(--card-tone); stroke-width: 3px; }
    a.node { cursor: pointer; }
    a.node:hover circle.ring { stroke: var(--accent-2); }
  `,
  template: `
    <div class="cycle-card">
      <svg [attr.viewBox]="viewBox()" preserveAspectRatio="xMidYMid meet" role="img" aria-label="ciclo de doações">
        <defs>
          <marker id="cyc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--red)" />
          </marker>
          @for (n of ring().nodes; track n.node.cpfCnpj) {
            @if (n.node.photoUrl) {
              <clipPath [attr.id]="clipId(n)"><circle [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="NODE_R" /></clipPath>
            }
          }
        </defs>
        @for (e of ring().edges; track $index) {
          <path [attr.d]="e.d" fill="none" stroke="var(--red)" stroke-width="2" stroke-dasharray="7 5" opacity=".9" marker-end="url(#cyc-arrow)" />
          @if (e.amount > 0) {
            <text class="edge-label" [attr.x]="e.lx" [attr.y]="e.ly" text-anchor="middle">{{ brl(e.amount) }}</text>
          }
        }
        @for (n of ring().nodes; track n.node.cpfCnpj) {
          <a class="node" [routerLink]="n.link">
            <circle class="ring" [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="NODE_R"
                    [attr.fill]="n.node.type === 'company' ? 'var(--accent-tint)' : 'var(--active)'"
                    [attr.stroke]="n.self ? 'var(--accent-2)' : 'var(--border-2)'" [attr.stroke-width]="n.self ? 2.5 : 1.2" />
            @if (n.node.photoUrl) {
              <image [attr.href]="n.node.photoUrl" [attr.x]="n.x - NODE_R" [attr.y]="n.y - NODE_R" [attr.width]="NODE_R * 2"
                     [attr.height]="NODE_R * 2" [attr.clip-path]="'url(#' + clipId(n) + ')'" preserveAspectRatio="xMidYMid slice" />
            } @else {
              <text [attr.x]="n.x" [attr.y]="n.y + 4" text-anchor="middle" font-size="12" fill="var(--muted)">
                {{ n.node.type === 'company' ? '▣' : n.node.label.charAt(0) }}
              </text>
            }
            <text class="node-label" [attr.x]="n.x" [attr.y]="n.y + NODE_R + 13" text-anchor="middle">{{ short(n.node.label) }}</text>
          </a>
        }
      </svg>

      <div class="cycle-card__scrim">
        <div class="row wrap gap-2">
          @if (severity() === 'high') {
            <span class="badge badge--red">alta</span>
          }
          <span class="mono" style="font-size: 10px; color: var(--muted-2)">
            {{ roleLabel() }} · circular_donations{{ pathLength() ? ' · ' + pathLength() + ' nós' : '' }}
          </span>
          @if (aiReview(); as r) {
            <app-ai-badge [review]="r" />
          }
          @if (amountCents() != null) {
            <span class="num" style="font-size: 13px; margin-left: auto">{{ brl(amountCents()) }}</span>
          }
        </div>
        @if (aiReview(); as r) {
          <p class="cycle-card__ai"><span class="mono-label">IA</span> {{ r.explanation }}</p>
        }
      </div>

      @if (graphIds()?.length) {
        <a class="btn cycle-card__cta" routerLink="/grafo" [queryParams]="{ add: graphIds()!.join(',') }">grafo completo</a>
      }
    </div>
  `,
})
export class CycleGraphComponent {
  readonly nodes = input.required<CycleNode[]>();
  readonly selfCpfCnpj = input<string | null>(null);
  readonly edgeAmounts = input<number[]>([]);
  readonly severity = input<'low' | 'medium' | 'high'>('medium');
  readonly roleLabel = input('');
  readonly aiReview = input<AiReviewBrief | null>(null);
  readonly amountCents = input<number | null>(null);
  readonly pathLength = input<number | null>(null);
  readonly graphIds = input<string[] | null>(null);

  protected readonly NODE_R = NODE_R;
  protected readonly brl = formatBRL;

  private readonly size = computed(() => {
    const n = this.nodes().length;
    const radius = n === 2 ? 130 : n <= 3 ? 90 : n <= 5 ? 92 : 92 + (n - 5) * 14;
    return { radius, side: radius * 2 + 120 };
  });

  protected readonly viewBox = computed(() => {
    const { side } = this.size();
    return `0 -70 ${side} ${side + 70}`;
  });

  protected readonly ring = computed(() => {
    const cycle = this.nodes();
    const n = cycle.length;
    const { radius, side } = this.size();
    const self = this.selfCpfCnpj();
    const nodes: RingNode[] = cycle.map((c, i) => {
      const a = (2 * Math.PI * i) / n;
      return {
        node: c,
        x: side / 2 + radius * Math.cos(a),
        y: side / 2 + radius * Math.sin(a),
        self: self != null && c.cpfCnpj === self,
        link: c.personId != null ? ['/politico', String(c.personId)] : c.cpfCnpj.length === 14 ? ['/cnpj', c.cpfCnpj] : ['/cpf', c.cpfCnpj],
      };
    });
    const amounts = this.edgeAmounts();
    const edges: RingEdge[] = nodes.map((from, i) => {
      const to = nodes[(i + 1) % n];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const x1 = from.x + ux * (NODE_R + 2);
      const y1 = from.y + uy * (NODE_R + 2);
      const x2 = to.x - ux * (NODE_R + 6);
      const y2 = to.y - uy * (NODE_R + 6);
      const bend = n === 2 ? 40 : 0;
      const mx = (x1 + x2) / 2 - uy * bend;
      const my = (y1 + y2) / 2 + ux * bend;
      const d = bend ? `M${x1},${y1} Q${mx},${my} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
      return { d, lx: mx, ly: my - 4, amount: amounts[i] ?? 0 };
    });
    return { nodes, edges };
  });

  protected clipId(n: RingNode): string {
    return `cyc-${n.node.cpfCnpj}`;
  }

  protected short(label: string): string {
    return label.length > 22 ? label.slice(0, 21) + '…' : label;
  }
}

@Component({
  selector: 'app-signal-card',
  imports: [RouterLink, AiBadgeComponent],
  template: `
    <article class="signal" [class]="'signal signal--' + (signal().severity === 'high' ? 'high' : 'medium')">
      <div class="row wrap gap-3">
        @if (signal().severity === 'high') {
          <span class="badge badge--red">alta</span>
        }
        <span class="mono" style="font-size: 10px; color: var(--muted-2)">{{ roleLabel() }} · {{ signal().rule }}</span>
        @if (signal().aiReview; as r) {
          <app-ai-badge [review]="r" />
        }
        @if (signal().expense; as e) {
          <span class="num" style="font-size: 13px; margin-left: auto">{{ brl(e.amountCents) }}</span>
        }
        @if (signal().graphIds?.length) {
          <a class="btn btn--small" routerLink="/grafo" [queryParams]="{ add: signal().graphIds!.join(',') }">grafo completo</a>
        }
      </div>
      <p style="margin: 6px 0 0; font-size: 13px; line-height: 1.45; color: var(--fg-2)">{{ signal().explanation }}</p>
      @if (signal().aiReview; as r) {
        <p class="ai-note"><span class="mono-label">IA</span> {{ r.explanation }}</p>
      }
      @if (signal().expense; as e) {
        <div class="mono mt-1" style="font-size: 10px; color: var(--muted-2)">{{ e.year }} · fornecedor: {{ e.supplierName ?? 'n/d' }}</div>
      }
    </article>
  `,
})
export class SignalCardComponent {
  readonly signal = input.required<Signal>();
  protected readonly brl = formatBRL;
  protected readonly roleLabel = computed(() => signalRoleLabel(this.signal().role));
}

export function signalRoleLabel(role: string): string {
  return role === 'candidate' ? 'como candidato' : role === 'cycle_member' ? 'no ciclo' : 'como fornecedor';
}
