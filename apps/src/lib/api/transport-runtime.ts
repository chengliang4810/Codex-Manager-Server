import {
  buildWebGatewayRuntimeCapabilities,
  normalizeRpcBaseUrl,
} from "../runtime/runtime-capabilities";
import { RuntimeCapabilities } from "../../types";

const DEFAULT_WEB_RPC_BASE_URL = "/api/rpc";
const CONFIGURED_WEB_RPC_BASE_URL = normalizeRpcBaseUrl(
  process.env.NEXT_PUBLIC_CODEXMANAGER_RPC_BASE_URL
);

let runtimeCapabilitiesCache: RuntimeCapabilities | null = null;
let runtimeCapabilitiesPromise: Promise<RuntimeCapabilities> | null = null;

function cacheRuntimeCapabilities(
  runtimeCapabilities: RuntimeCapabilities
): RuntimeCapabilities {
  runtimeCapabilitiesCache = runtimeCapabilities;
  return runtimeCapabilities;
}

export function getCachedRuntimeCapabilities(): RuntimeCapabilities | null {
  return runtimeCapabilitiesCache;
}

export async function loadRuntimeCapabilities(
  force = false
): Promise<RuntimeCapabilities> {
  if (!force && runtimeCapabilitiesCache) {
    return runtimeCapabilitiesCache;
  }
  if (!force && runtimeCapabilitiesPromise) {
    return runtimeCapabilitiesPromise;
  }

  runtimeCapabilitiesPromise = (async () => {
    return cacheRuntimeCapabilities(
      buildWebGatewayRuntimeCapabilities(
        CONFIGURED_WEB_RPC_BASE_URL || DEFAULT_WEB_RPC_BASE_URL
      )
    );
  })();

  try {
    return await runtimeCapabilitiesPromise;
  } finally {
    runtimeCapabilitiesPromise = null;
  }
}
