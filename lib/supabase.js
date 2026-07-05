const SUPABASE_URL = 'https://elpjenadpravhjdmtxas.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGplbmFkcHJhdmhqZG10eGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTk5MTcsImV4cCI6MjA5ODgzNTkxN30.vZyMhAamhMsOmsP5r9ukwuzNHsO3XUjxMCJ-Ib1bB2o';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
