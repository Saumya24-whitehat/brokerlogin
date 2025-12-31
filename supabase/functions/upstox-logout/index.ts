import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Upstox logout attempt for user: ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session details from database
    const { data: sessionData, error: dbError } = await supabase
      .from('broker_sessions')
      .select('session_token')
      .eq('user_name', userId)
      .eq('broker', 'upstox')
      .single();

    if (dbError || !sessionData) {
      console.log('No active Upstox session found for user:', userId);
      return new Response(
        JSON.stringify({ success: false, error: 'No active session found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = sessionData.session_token;

    // Call Upstox logout API
    const logoutResponse = await fetch('https://api.upstox.com/v2/logout', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const logoutData = await logoutResponse.json();
    console.log('Upstox logout response:', logoutData);

    if (logoutData.status === 'success' && logoutData.data === true) {
      // Update session status in database
      await supabase
        .from('broker_sessions')
        .update({ 
          session_status: 'logged_out',
          session_token: null
        })
        .eq('user_name', userId)
        .eq('broker', 'upstox');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Logged out successfully',
          logoutTime: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('Upstox logout failed:', logoutData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Logout failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in Upstox logout:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
