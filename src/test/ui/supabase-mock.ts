import { vi } from "vitest";

export interface QueryState {
  table: string;
  head: boolean;
  filters: Array<{ op: string; column: string; value: unknown }>;
}

type Resolver = (state: QueryState) => { data?: unknown; count?: number; error?: unknown };

/**
 * Minimal chainable stand-in for the Supabase JS query builder.
 * `resolver` receives the accumulated table/filter state and returns the response.
 */
export function createSupabaseMock(resolver: Resolver) {
  const from = vi.fn((table: string) => {
    const state: QueryState = { table, head: false, filters: [] };

    const builder: any = {
      _state: state,
      then: (onFulfilled: any, onRejected: any) => {
        const res = resolver(state);
        return Promise.resolve({
          data: res.data ?? null,
          count: res.count ?? null,
          error: res.error ?? null,
        }).then(onFulfilled, onRejected);
      },
    };

    builder.select = (_cols?: string, opts?: { head?: boolean }) => {
      if (opts?.head) state.head = true;
      return builder;
    };
    for (const op of ["eq", "neq", "gte", "lte", "in", "is", "like"]) {
      builder[op] = (column: string, value: unknown) => {
        state.filters.push({ op, column, value });
        return builder;
      };
    }
    for (const op of ["order", "limit", "update", "insert", "range"]) {
      builder[op] = () => builder;
    }
    return builder;
  });

  const channel = vi.fn(() => {
    const ch: any = { on: () => ch, subscribe: () => ch };
    return ch;
  });

  return {
    from,
    channel,
    removeChannel: vi.fn(),
  };
}

export function hasFilter(state: QueryState, column: string, value: unknown) {
  return state.filters.some((f) => f.column === column && f.value === value);
}
