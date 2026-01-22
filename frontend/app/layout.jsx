import "./globals.css";

export const metadata = {
  title: "PrivCode - Private Code Intelligence",
  description: "Secure offline code analysis system for startups",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
