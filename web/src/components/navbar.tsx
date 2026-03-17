'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, BarChart3, Bell, Menu, X } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-blue-600 text-white px-4 py-3" aria-label="Main navigation">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Home className="w-5 h-5" />
          Cyprus Rental Agent
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
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

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-nav" className="md:hidden mt-3 pt-3 border-t border-blue-500 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 py-2 text-sm hover:text-blue-200 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/webhooks"
            className="flex items-center gap-2 py-2 text-sm hover:text-blue-200 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Bell className="w-4 h-4" />
            Webhooks
          </Link>
        </div>
      )}
    </nav>
  );
}
