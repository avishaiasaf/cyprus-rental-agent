import Link from 'next/link';
import { Home, BarChart3, Bell } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg">
        <Home className="w-5 h-5" />
        Cyprus Rental Agent
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm hover:text-blue-200 transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Dashboard
        </Link>
        <Link
          href="/webhooks"
          className="flex items-center gap-1 text-sm hover:text-blue-200 transition-colors"
        >
          <Bell className="w-4 h-4" />
          Webhooks
        </Link>
      </div>
    </nav>
  );
}
