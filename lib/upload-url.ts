const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export function resolveUploadUrl(url: string) {
  if (!url) return '';

  const baseUrl = API_BASE_URL.replace(/\/$/, '');

  if (/^(blob:|data:)/i.test(url)) return url;

  if (/^https?:/i.test(url)) {
    try {
      const parsedUrl = new URL(url);

      return parsedUrl.pathname.startsWith('/uploads/') && baseUrl
        ? `${baseUrl}${parsedUrl.pathname}${parsedUrl.search}`
        : url;
    } catch {
      return url;
    }
  }

  const uploadPath = url.startsWith('/') ? url : `/${url}`;

  return baseUrl ? `${baseUrl}${uploadPath}` : uploadPath;
}
