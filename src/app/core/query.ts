import { Router } from '@angular/router';

export function intParam(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export function pageParam(v: string | null | undefined): number {
  const n = intParam(v);
  return n != null && n >= 1 ? n : 1;
}

export function patchQuery(router: Router, patch: Record<string, string | number | null | undefined>): void {
  const queryParams: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(patch)) queryParams[k] = v === '' || v === undefined ? null : v;
  if (!('page' in patch)) queryParams['page'] = null;
  router.navigate([], { queryParams, queryParamsHandling: 'merge' });
}
