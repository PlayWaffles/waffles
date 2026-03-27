declare module "vitest" {
  export const describe: (...args: unknown[]) => void;
  export const it: (...args: unknown[]) => void;
  export const expect: (...args: unknown[]) => {
    toBe: (...args: unknown[]) => void;
    toEqual: (...args: unknown[]) => void;
    toMatchObject: (...args: unknown[]) => void;
    toHaveLength: (...args: unknown[]) => void;
    toBeLessThan: (...args: unknown[]) => void;
    toBeGreaterThan: (...args: unknown[]) => void;
    toBeCloseTo: (...args: unknown[]) => void;
    toContain: (...args: unknown[]) => void;
  };
}
