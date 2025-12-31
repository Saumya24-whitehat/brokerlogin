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
        JSON.stringify({ success: false, error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Checking Upstox session for user: ${userId}`);

    // Get session from database - check both active and expired sessions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: session, error: fetchError } = await supabase
      .from('broker_sessions')
      .select('*')
      .eq('user_name', userId)
      .eq('broker_name', 'upstox')
      .maybeSingle();

    if (fetchError || !session) {
      console.log('No session found for user:', userId);
      return new Response(
        JSON.stringify({ success: false, sessionActive: false, error: 'No session found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = session.session_token;

    // Verify session by calling profile API
    console.log('Verifying session with Upstox API...');
    const profileResponse = await fetch('https://api.upstox.com/v2/user/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok || profileData.status !== 'success') {
      console.log('Session expired or invalid:', profileData);
      
      // Update session status to expired
      await supabase
        .from('broker_sessions')
        .update({ 
          session_status: 'expired',
          last_check_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_name', userId)
        .eq('broker_name', 'upstox');

      // Upstox OAuth doesn't support auto re-login - user must manually authorize again
      return new Response(
        JSON.stringify({ 
          success: true, 
          sessionActive: false, 
          accountName: session.account_name,
          requiresManualLogin: true,
          message: 'Upstox session expired. Please login again manually (OAuth required).'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session is still active');

    // Update last check time and ensure status is active
    await supabase
      .from('broker_sessions')
      .update({ 
        session_status: 'active',
        last_check_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_name', userId)
      .eq('broker_name', 'upstox');

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionActive: true,
        lastCheckTime: new Date().toISOString(),
        accountName: session.account_name,
        userName: profileData.data?.user_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error checking Upstox session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
