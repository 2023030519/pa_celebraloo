"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { ui } from "@/components/ui";

// Las releases de la APK (apk/ en esta repo) se publican en la repo pública del autor.
const REPO = "2023030519/pa_celebraloo";
const LATEST_APK = `https://github.com/${REPO}/releases/latest/download/celebraloo-admin.apk`;

/** "v0.10.0" > "0.9.3". */
export function isNewer(remote: string, local: string): boolean {
  const a = remote.replace(/^v/, "").split(".").map(Number);
  const b = local.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return false;
}

type State = { installed: string | null; latest: string | null } | null;

/**
 * App de Android: dentro de la APK (su user agent trae "CelebralooAdminApp/<versión>") avisa si
 * hay una más nueva en las releases y la descarga; en el navegador, ofrece instalarla.
 */
export function AppUpdate() {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const installed = navigator.userAgent.match(/CelebralooAdminApp\/([\d.]+)/)?.[1] ?? null;
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((release: { tag_name?: string } | null) => setState({ installed, latest: release?.tag_name ?? null }))
      .catch(() => setState({ installed, latest: null }));
  }, []);

  if (!state) return <p className="text-[13px] text-ink-600">Buscando la app de Android…</p>;
  const { installed, latest } = state;
  const update = installed && latest && isNewer(latest, installed);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Smartphone size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-600" />
        <div className="text-[13px]">
          <p className="font-medium text-ink-950">{installed ? `App de Android ${installed}` : "App de Android"}</p>
          <p className="text-ink-600" role="status">
            {!installed
              ? latest
                ? `Versión ${latest.replace(/^v/, "")}: el panel a pantalla completa en tu celular.`
                : "Aún no hay una APK publicada."
              : update
                ? `Hay una versión nueva: ${latest.replace(/^v/, "")}.`
                : latest
                  ? "Tienes la última versión."
                  : "No se pudo revisar si hay una versión nueva."}
          </p>
        </div>
      </div>
      {(update || (!installed && latest)) && (
        // Sale del panel: Android abre el navegador, que baja la APK y pide confirmar la instalación.
        <a href={LATEST_APK} target="_blank" rel="noreferrer" className={update ? ui.buttonPrimarySm : ui.buttonSecondarySm}>
          <Download size={14} aria-hidden="true" />
          {update ? "Actualizar" : "Descargar APK"}
        </a>
      )}
    </div>
  );
}
