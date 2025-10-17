import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bulk Payroll Management',
  description: 'Upload, validate, and process batch payroll payments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
