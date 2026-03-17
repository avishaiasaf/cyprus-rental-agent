import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 py-6 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div>&copy; {new Date().getFullYear()} Cyprus Rental Agent</div>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/webhooks" className="hover:text-white transition-colors">
            Webhooks
          </Link>
        </div>
      </div>
    </footer>
  );
}
