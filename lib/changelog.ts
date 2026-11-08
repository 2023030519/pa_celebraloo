/**
 * Novedades del panel por versión, la más reciente primero. Al subir "version" en
 * package.json, agrega aquí su entrada: Configuración › Versión la busca por ese número.
 */
export const CHANGELOG: { version: string; date: string; changes: string[] }[] = [
  {
    version: "0.2.0",
    date: "2026-11-08",
    changes: [
      "Rediseño completo: barra lateral oscura agrupada por área, letra Inter, y tablas, cifras y filtros con el mismo estilo en todas las secciones.",
      "Versión para celular: barra inferior con Inicio, Alertas, Clientes, Eventos y Más; listas como tarjetas; filtros plegables; botones de 44 px y la acción principal al alcance del pulgar.",
      "Tocar otra vez la sección abierta (en la barra lateral o la inferior) la actualiza y te lleva arriba.",
      "Tema claro, oscuro o del sistema en Configuración › Apariencia.",
      "Versión del panel y sus novedades en Configuración › Versión.",
      "Los correos largos se achican para caber en un renglón en lugar de partirse.",
      "App de Android (apk/): abre el panel a pantalla completa; Configuración › Versión avisa cuando hay una APK nueva.",
      "La ficha de cliente abre más rápido (sus consultas van en paralelo y las notas ya no descargan la lista entera de usuarios) y muestra un esqueleto mientras carga.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-05",
    changes: ["Primera versión del panel de administración."],
  },
];
