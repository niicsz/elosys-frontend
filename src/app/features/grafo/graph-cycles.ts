export interface CycleEdge {
  source: string;
  target: string;
}

export function findCircularEdgeKeys(nodeIds: string[], edges: CycleEdge[]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  const sccOf = new Map<string, number>();
  const sccSize = new Map<number, number>();
  let sccCount = 0;

  for (const start of adj.keys()) {
    if (indices.has(start)) continue;
    const work: Array<{ v: string; i: number }> = [{ v: start, i: 0 }];
    indices.set(start, index);
    lowlink.set(start, index);
    index++;
    stack.push(start);
    onStack.set(start, true);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const { v } = frame;
      const neighbors = adj.get(v) ?? [];
      if (frame.i < neighbors.length) {
        const w = neighbors[frame.i++];
        if (!indices.has(w)) {
          indices.set(w, index);
          lowlink.set(w, index);
          index++;
          stack.push(w);
          onStack.set(w, true);
          work.push({ v: w, i: 0 });
        } else if (onStack.get(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
        }
      } else {
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1].v;
          lowlink.set(parent, Math.min(lowlink.get(parent)!, lowlink.get(v)!));
        }
        if (lowlink.get(v) === indices.get(v)) {
          let size = 0;
          let w: string;
          do {
            w = stack.pop()!;
            onStack.set(w, false);
            sccOf.set(w, sccCount);
            size++;
          } while (w !== v);
          sccSize.set(sccCount, size);
          sccCount++;
        }
      }
    }
  }

  const circular = new Set<string>();
  for (const e of edges) {
    const s = sccOf.get(e.source);
    if (s !== undefined && s === sccOf.get(e.target) && (sccSize.get(s) ?? 0) > 1) {
      circular.add(`${e.source}|${e.target}`);
    }
  }
  return circular;
}
