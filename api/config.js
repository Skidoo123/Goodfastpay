// Vercel Serverless Function: Expose Public Client Configuration
// This endpoint safely returns the public Supabase URL and Anon Key to the client browser.
// Note: Never return SUPABASE_SERVICE_ROLE_KEY or any secret keys here.

export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://btbolekfrcwzzjqhorgi.supabase.co";
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Ym9sZWtmcmN3enpqcWhvcmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU4MDksImV4cCI6MjEwMjA0MTgwOX0.b77fO24vUgDpvRcyqGdX_kdYFAx4JKEUUFKi0Rv2fJc";

    res.status(200).json({
        supabaseUrl: supabaseUrl,
        supabaseAnonKey: supabaseAnonKey
    });
}
