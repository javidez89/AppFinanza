export function appPath(path: string) {
  if (typeof window === "undefined") return path;
  const basePath = window.location.pathname.startsWith("/AppFinanza/") ? "/AppFinanza" : "";
  return `${basePath}${path}`;
}
