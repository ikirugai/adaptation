export { pool, query, one, withClient } from "./db";
export { getOrCreateSession, getSessionIdOrNull } from "./session";
export {
  loadActivePatches,
  applyPatches,
  applyItemFilter,
  isTargetHidden,
  targetStyle,
  targetRename,
  targetKey,
  type PatchRow,
  type RenderContext,
  type ItemFilter
} from "./patches";
export {
  validatePatch,
  type Patch,
  type Op,
  type TargetRef,
  type SectionRef,
  type KnownFeatureTarget
} from "./dsl";
export {
  defineSurface,
  generateDSLPrompt,
  type Surface,
  type SurfaceSpec,
  type SurfaceFlag,
  type SurfaceTarget,
  type SurfaceBakedFeature
} from "./surface";
