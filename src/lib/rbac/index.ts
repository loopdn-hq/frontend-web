export {
  fetchAccountFeatures,
  type AccountFeatures,
} from "@/lib/rbac/features";
export { useFeatures, type FeaturesState } from "@/lib/rbac/useFeatures";
export {
  meets,
  type Requirement,
  type RequirementContext,
} from "@/lib/rbac/requirements";
export {
  fetchPermissionsMatrix,
  type Grant,
  type MatrixArea,
  type MatrixAxis,
  type MatrixFeature,
  type MatrixResult,
  type PermissionsMatrix,
  setGrant,
  type SetGrantResult,
} from "@/lib/rbac/matrix";
export { allows, GROUP, type GroupFeature } from "@/lib/rbac/conversation";
