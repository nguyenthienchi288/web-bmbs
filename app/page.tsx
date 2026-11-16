'use client';

import { useEffect, useState } from 'react';

export default function BmbsAppPage() {
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    // 1. Tạo cầu nối giả lập google.script.run gọi thẳng tới /api/bmbs trên Vercel
    const createRpcProxy = () => {
      let onSuccess: ((res: any) => void) | null = null;
      let onFailure: ((err: any) => void) | null = null;

      const handler: ProxyHandler<any> = {
        get(_, prop: string) {
          if (prop === 'withSuccessHandler') {
            return (fn: (res: any) => void) => {
              onSuccess = fn;
              return new Proxy({}, handler);
            };
          }
          if (prop === 'withFailureHandler') {
            return (fn: (err: any) => void) => {
              onFailure = fn;
              return new Proxy({}, handler);
            };
          }
          // Mọi lời gọi hàm backend (apiLogin, apiGetAppData, apiGuiPhanHoi...)
          return async (...args: any[]) => {
            try {
              const res = await fetch('/api/bmbs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ functionName: prop, args }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Lỗi máy chủ');
              if (onSuccess) onSuccess(data);
            } catch (err: any) {
              if (onFailure) onFailure(err);
              else console.error('RPC Error:', err);
            }
          };
        },
      };
      return new Proxy({}, handler);
    };

    (window as any).google = {
      script: {
        get run() {
          return createRpcProxy();
        },
      },
    };

    // 2. Nạp giao diện HTML và kích hoạt AppJS
    fetch('/bmbs-body.html')
      .then((res) => res.text())
      .then((html) => {
        setHtmlContent(html);
        setTimeout(() => {
          const script = document.createElement('script');
          script.src = '/bmbs-app.js';
          script.onload = () => {
            if (typeof (window as any).onload === 'function') {
              (window as any).onload();
            }
          };
          document.body.appendChild(script);
        }, 50);
      });
  }, []);

  if (!htmlContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white/75 backdrop-blur-2xl px-5 py-3.5 rounded-full shadow-lg flex items-center gap-3 border border-white/50">
          <div className="spinner"></div>
          <span className="text-xs font-bold text-slate-800">Đang khởi động Hệ thống BMBS...</span>
        </div>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}