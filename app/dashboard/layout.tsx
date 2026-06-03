import Navbar from './components/Navbar/Navbar';
import Sidebar from './components/Sidebar/Sidebar';
import Body from './components/Body/Body';

export const metadata = {
  title: 'Dashboard - Compliance Web',
  description: 'Admin dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-[#f7f7fb]">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Body>{children}</Body>
        </div>
      </div>
    </div>
  );
}
