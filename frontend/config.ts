const config = {
  backendUrl:
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://it3030-paf-2026-smart-campus-group-production.up.railway.app",
  googleClientId:
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "802048326707-14o5iabs5aeltgj0f7afqflbp0n81ige.apps.googleusercontent.com",
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://uzwrxyeskgfxbbznfyoi.supabase.co",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6d3J4eWVza2dmeGJiem5meW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODk4MDAsImV4cCI6MjA5MTU2NTgwMH0.Ja2LTy0vGG2E4ceQt6Xz5QfFgLKJb26iuaw-Qw5tXGc",
};

export default config;
