import StatusClient from "./StatusClient";

export default function SupaPlanPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">
        SupaPlan Tasks
      </h1>

      <StatusClient />
    </div>
  );
}