import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });

/**
 * Entrega un PDF al usuario en cualquier dispositivo.
 * - App móvil (Android/iOS): lo guarda y abre el menú de compartir/guardar del sistema, porque
 *   las descargas por enlace no funcionan en el WebView.
 * - Web (escritorio y navegador móvil): descarga el archivo; si el navegador no permite
 *   descargas por enlace, lo abre en una pestaña nueva.
 */
export async function savePdf(blob: Blob, filename: string): Promise<"shared" | "downloaded" | "opened"> {
  if (Capacitor.isNativePlatform()) {
    const saved = await Filesystem.writeFile({
      path: filename,
      data: await toBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, dialogTitle: "Comprobante de pago", url: saved.uri });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    if ("download" in link) {
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return "downloaded";
    }
    window.open(url, "_blank", "noopener");
    return "opened";
  } finally {
    // El navegador necesita unos segundos para iniciar la descarga antes de liberar el archivo.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
