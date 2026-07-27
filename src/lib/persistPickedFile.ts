/**
 * Chrome on Android can revoke File access as soon as the <input> value is cleared
 * (or shortly after the picker closes). Copy bytes into a new in-memory File so
 * later async prepare/upload still works.
 */
export async function persistPickedFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const name = file.name?.trim() || "foto.jpg";
  return new File([buffer], name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified || Date.now(),
  });
}

export async function persistPickedFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => persistPickedFile(f)));
}

export function isFilePermissionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("permission problems") ||
    m.includes("could not be read") ||
    m.includes("notallowederror") ||
    m.includes("the requested file")
  );
}
