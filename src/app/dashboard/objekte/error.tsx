"use client";

export default function ObjekteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-600 font-medium">Fehler beim Laden der Objekte</p>
      <p className="text-sm text-gray-500">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-lg text-sm"
      >
        Erneut versuchen
      </button>
    </div>
  );
}