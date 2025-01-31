// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full bg-gray-900 text-white antialiased">
        <div className="min-h-full flex flex-col">
          {children}
          <footer className="mt-auto p-4 text-center text-sm text-gray-400">
            Powered by Supercar Match © {new Date().getFullYear()}
          </footer>
        </div>
      </body>
    </html>
  );
}



import './globals.css'