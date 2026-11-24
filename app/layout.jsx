export const metadata = {
  title: "Euro Parts Manager",
  description: "輸入車パーツ 在庫・注文管理システム",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          background: "#f5f6f8",
          color: "#1f2937",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
