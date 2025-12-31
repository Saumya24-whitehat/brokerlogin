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
    const { userName } = await req.json();

    if (!userName) {
      return new Response(
        JSON.stringify({ success: false, error: 'userName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Samco logout attempt for user: ${userName}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session details from database
    const { data: sessionData, error: dbError } = await supabase
      .from('broker_sessions')
      .select('session_token')
      .eq('user_name', userName)
      .eq('broker', 'semco')
      .single();

    if (dbError || !sessionData) {
      console.log('No active Samco session found for user:', userName);
      return new Response(
        JSON.stringify({ success: false, error: 'No active session found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionToken = sessionData.session_token;

    // Call Samco logout API
    const logoutResponse = await fetch('https://tradeapi.samco.in/logout', {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-session-token': sessionToken,
      },
    });

    const logoutData = await logoutResponse.json();
    console.log('Samco logout response:', logoutData);

    if (logoutData.status === 'Success') {
      // Update session status in database
      await supabase
        .from('broker_sessions')
        .update({ 
          session_status: 'logged_out',
          session_token: null
        })
        .eq('user_name', userName)
        .eq('broker', 'semco');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Logged out successfully',
          logoutTime: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('Samco logout failed:', logoutData.statusMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: logoutData.statusMessage || 'Logout failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in Samco logout:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
