import { Roboto } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/theme/theme";
import { ToasterProvider } from "@/components/toaster-provider";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata = {
  title: "Duton",
  description: "Duton is a platform for monitoring and managing your sensors.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={roboto.variable}>
      <body className="antialiased">
         <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
          {children}
          <ToasterProvider />
          </ThemeProvider>
      </body>
    </html>
  );
}
