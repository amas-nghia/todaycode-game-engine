/**
 * Level definition contract — port of pkg/gamecore/level.go.
 *
 * No golden fixture exercises LevelDef directly, so `unknown` for the opaque
 * `definition`/`grading` payloads is sufficient — no need to preserve
 * raw-byte fidelity like Go's `json.RawMessage`.
 */
export interface LevelDef {
  slug: string;
  version: number;
  gameSlug: string;
  definition: unknown;
  grading?: unknown;
}

/** Throws instead of returning a Go-style error. */
export interface LevelValidator {
  validateLevel(definition: unknown): void;
}
