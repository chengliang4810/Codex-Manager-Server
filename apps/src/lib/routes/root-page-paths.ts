export const ROOT_PAGE_PATHS = [
  "/",
  "/accounts",
  "/apikeys",
  "/models",
  "/plugins",
  "/logs",
  "/settings",
] as const;

export type RootPagePath = (typeof ROOT_PAGE_PATHS)[number];
