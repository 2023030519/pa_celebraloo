import { requireAdmin } from "@/lib/auth/require-admin";
import { formatMxn, getCatalog, type CatalogItem } from "@/lib/data/catalog";
import { CatalogRowEditor } from "@/components/catalog-row-editor";
import { CatalogOverview } from "@/components/catalog-overview";
import { Badge, PageTitle, Table } from "@/components/ui";

function ReadOnlyRows({ items }: { items: CatalogItem[] }) {
  return items.map((item) => (
    <tr key={item.key}>
      <td className="px-3 py-2.5">
        <p className="font-medium">{item.name}</p>
        <p className="font-mono text-[11px] text-ink-600">{item.key}</p>
      </td>
      <td className="px-3 py-2.5 tabular-nums">{formatMxn(item.priceCents)}</td>
      <td className="px-3 py-2.5">{item.isActive ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
      <td className="px-3 py-2.5 text-ink-600">{item.capabilities.length} permisos</td>
    </tr>
  ));
}

export default async function CatalogPage() {
  const admin = await requireAdmin();
  const catalog = await getCatalog();
  const editable = admin.isSuperAdmin;
  const head = ["Nombre", "Precio (MXN)", "Estado", editable ? "Guardar" : "Incluye"];

  const rows = (kind: "plan" | "addon", items: CatalogItem[]) =>
    editable ? (
      items.map((item) => (
        <CatalogRowEditor
          key={item.key}
          kind={kind}
          itemKey={item.key}
          name={item.name}
          priceCents={item.priceCents}
          isActive={item.isActive}
        />
      ))
    ) : (
      <ReadOnlyRows items={items} />
    );

  return (
    <>
      <PageTitle
        title={editable ? "Planes y complementos" : "Catálogo"}
        subtitle={
          editable
            ? "Resumen comercial y, abajo, edición. Los cambios aplican desde el siguiente pago; lo ya comprado no cambia."
            : "Solo lectura: editar el catálogo es de superadmin."
        }
      />

      {editable && <CatalogOverview catalog={catalog} />}

      {editable && <h2 className="mb-3 border-t border-ink-150 pt-6 text-[15px] font-semibold">Editar catálogo</h2>}
      <h2 className="mb-2 text-[15px] font-semibold">Paquetes</h2>
      <Table head={head} empty={catalog.plans.length === 0 ? "Sin paquetes." : undefined}>
        {rows("plan", catalog.plans)}
      </Table>

      <h2 className="mb-2 mt-8 text-[15px] font-semibold">Complementos</h2>
      <p className="mb-3 text-ink-600">
        Sin precio = aún no se vende. Inactivo = se oculta de la tienda y el checkout lo rechaza. Los cupos por escalones
        (álbum y galería) cobran la diferencia calculada en Celebraloo, no este precio.
      </p>
      <Table head={head} empty={catalog.addons.length === 0 ? "Sin complementos." : undefined}>
        {rows("addon", catalog.addons)}
      </Table>
    </>
  );
}
