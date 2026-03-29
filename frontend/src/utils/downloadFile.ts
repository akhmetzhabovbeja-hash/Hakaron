import apiClient from "../api/client";

/**
 * Download a file via apiClient (sends JWT token).
 * Creates a temporary blob link and triggers the browser download.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await apiClient.get(url, { responseType: "blob" });
  const blob = new Blob([response.data]);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
