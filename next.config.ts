import type { NextConfig } from "next";

// Spec 0008 (R8/M2): headers de seguridad + CSP. Antes este archivo estaba
// vacío: en producción solo venía el HSTS que pone Vercel por default.
//
// Sin nonces, por las mismas razones que en Sonda (spec 0007 R6): Listo no carga
// scripts de terceros, y usa `style={{}}` inline en todo el UI del hijo
// (Three.js, planetas, animaciones), así que style-src necesita 'unsafe-inline'
// de cualquier forma — los nonces no cubren atributos style. El objetivo real es
// bloquear orígenes externos, clickjacking y MIME sniffing.
//
// Diferencia con Sonda: acá connect-src tiene que permitir Supabase, incluido
// wss:// para el realtime del dashboard del padre.
const isDev = process.env.NODE_ENV === "development";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null;
  } catch {
    return null;
  }
})();

// Si no se puede derivar el host del env, se cae a un wildcard de supabase.co
// (más amplio, pero no rompe el producto en un deploy mal configurado).
const supabaseConnect = supabaseHost
  ? `https://${supabaseHost} wss://${supabaseHost}`
  : "https://*.supabase.co wss://*.supabase.co";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' ${supabaseConnect}${isDev ? " ws://localhost:* http://localhost:*" : ""};
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader.replace(/\s{2,}/g, " ").trim() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
