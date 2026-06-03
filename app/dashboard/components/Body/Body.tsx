'use client';

export default function Body({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-auto p-6">
      {/* Body content will go here */}
      {children}
    </main>
  );
}
