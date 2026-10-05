const PROTOCOL_RELATIVE = /^\/(?![/\\])/

export const sameOriginPath = (value: unknown, origin: string): string => {
  if (typeof value !== "string" || value === "") return "/"
  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    return "/"
  }
  if (url.origin !== origin) return "/"
  const path = `${url.pathname}${url.search}${url.hash}`
  return PROTOCOL_RELATIVE.test(path) ? path : "/"
}
