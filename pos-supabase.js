/* ====================================
   SUPABASE CLIENT — Org Admin (pos page)
   ------------------------------------
   This talks to the "Field Team Review System" Supabase project,
   which is separate from whatever sg-supabase.js connects to - so it
   gets its own client rather than reusing one meant for a different
   project.

   The anon/public key below is safe to ship in client-side code ONLY
   because Row Level Security is enabled on every table it touches
   (states, districts, blocks, assignments, assignments_history).
   Never put the service_role/secret key here or anywhere client-side.
==================================== */

const POS_SUPABASE_URL      = "https://xljnhbexevetzgaaehqc.supabase.co";
const POS_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsam5oYmV4ZXZldHpnYWFlaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5OTIzOTQsImV4cCI6MjEwNjU2ODM5NH0.Bk_TR38XLgk2s22UaUJv3VB6liCmOy-1o2Cn5UfpLXw";

// `supabase` here is the global UMD export from the CDN script tag
// loaded in index.html (https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2),
// already in scope because this file loads after that <script> tag.
window.posSupabase = supabase.createClient(POS_SUPABASE_URL, POS_SUPABASE_ANON_KEY);