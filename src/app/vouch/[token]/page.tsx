import VouchForm from "@/components/VouchForm";

// Public friend-vouch page — no login required.
export default function VouchPage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-2xl font-black text-flockie-blue">flockie</span>
      </div>
      <VouchForm token={params.token} />
    </main>
  );
}
