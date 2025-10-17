'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/bulk-payroll');
  }, [router]);

  return <div className="flex items-center justify-center min-h-screen">Redirecting to Bulk Payroll...</div>;
}
