// app/+html.tsx
import { Html, Head, Main, NextScript } from "expo-router";

export default function Root() {
  return (
    <Html>
      <Head>
        {/* Load Playfair Display with the weights you need */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
