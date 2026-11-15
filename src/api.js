// SustainIQ Bengaluru | Author: Vanshika Sharma
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The API is unavailable. Start the Node server and try again.",
    );
  }
  if (!response.ok) throw new Error(result.error || "The request failed.");
  return result;
}
