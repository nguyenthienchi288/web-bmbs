import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xứ Đoàn GX Bến Siêu - Hệ thống BMBS',
  description: 'Hệ thống Quản trị Lịch trực & Dự trưởng BMBS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          rel="stylesheet"
        />
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
          async
        />
      </head>
      <body className="selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}