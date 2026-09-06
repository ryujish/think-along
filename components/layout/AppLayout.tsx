import Header from './Header';
import BottomNavigation from './BottomNavigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080f17] text-[#f7f9fc] flex flex-col font-sans">
      <Header />
      <main className="mx-auto max-w-6xl w-full flex-1 px-6 py-6 pb-24">{children}</main>
      <BottomNavigation />
    </div>
  );
}
