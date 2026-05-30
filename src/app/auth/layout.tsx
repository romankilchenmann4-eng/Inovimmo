export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(214,62%,17%)] to-[hsl(214,55%,23%)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-white mb-1">
            <div className="w-8 h-8 bg-[hsl(214,76%,49%)] rounded-lg flex items-center justify-center text-base">🏛</div>
            <span className="text-2xl font-bold">Inovimmo</span>
          </div>
          <p className="text-white/50 text-xs">Swiss Property Intelligence</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
