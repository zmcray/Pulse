import { createContext, useContext } from "react";

export const BuildPipelineStateContext = createContext(null);
export const BuildPipelineDispatchContext = createContext(null);

export function useBuildPipelineState() {
  const ctx = useContext(BuildPipelineStateContext);
  if (!ctx)
    throw new Error("useBuildPipelineState must be used within BuildPipelineProvider");
  return ctx;
}

export function useBuildPipelineDispatch() {
  const ctx = useContext(BuildPipelineDispatchContext);
  if (!ctx)
    throw new Error("useBuildPipelineDispatch must be used within BuildPipelineProvider");
  return ctx;
}
