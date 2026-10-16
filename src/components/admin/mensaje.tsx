/**
 * Resultado de una acción del admin, junto al botón que la lanzó. Vale para
 * cualquier estado con `status` y `message` (talleres, inscritos, pagos…).
 */
export function Mensaje({ state }: { state: { status: string; message?: string } }) {
  if (state.status === "error" && state.message)
    return (
      <p role="alert" className="text-[13px] text-red-600">
        {state.message}
      </p>
    );
  if (state.status === "ok" && state.message)
    return (
      <p role="status" className="text-[13px] text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}
