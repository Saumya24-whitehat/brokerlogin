import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logout functions for each broker
async function logoutShoonya(supabase: any, session: any): Promise<boolean> {
  try {
    const jKey = session.session_token;
    const logoutPayload = `jData=${JSON.stringify({ uid: session.user_name })}&jKey=${jKey}`;
    
    const response = await fetch('https://api.shoonya.com/NorenWClientTP/Logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: logoutPayload,
    });
    
    const data = await response.json();
    console.log(`Shoonya logout for ${session.user_name}:`, data);
    return data.stat === 'Ok';
  } catch (e) {
    console.error(`Shoonya logout error for ${session.user_name}:`, e);
    return false;
  }
}

async function logoutSamco(supabase: any, session: any): Promise<boolean> {
  try {
    const response = await fetch('https://tradeapi.samco.in/logout', {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-session-token': session.session_token,
      },
    });
    
    const data = await response.json();
    console.log(`Samco logout for ${session.user_name}:`, data);
    return data.status === 'Success';
  } catch (e) {
    console.error(`Samco logout error for ${session.user_name}:`, e);
    return false;
  }
}

async function logoutAngelOne(supabase: any, session: any): Promise<boolean> {
  try {
    const response = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.session_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '00:00:00:00:00:00',
        'X-PrivateKey': session.encrypted_api_key,
      },
      body: JSON.stringify({ clientcode: session.user_name }),
    });
    
    const data = await response.json();
    console.log(`AngelOne logout for ${session.user_name}:`, data);
    return data.status === true || data.message === 'SUCCESS';
  } catch (e) {
    console.error(`AngelOne logout error for ${session.user_name}:`, e);
    return false;
  }
}

async function logoutUpstox(supabase: any, session: any): Promise<boolean> {
  try {
    const response = await fetch('https://api.upstox.com/v2/logout', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.session_token}`,
      },
    });
    
    const data = await response.json();
    console.log(`Upstox logout for ${session.user_name}:`, data);
    return data.status === 'success';
  } catch (e) {
    console.error(`Upstox logout error for ${session.user_name}:`, e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Scheduled logout - Starting logout for all active sessions');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active sessions
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('*')
      .eq('session_status', 'active');

    if (error) {
      console.error('Error fetching sessions:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const session of sessions || []) {
      let logoutSuccess = false;

      switch (session.broker) {
        case 'shoonya':
          logoutSuccess = await logoutShoonya(supabase, session);
          break;
        case 'semco':
          logoutSuccess = await logoutSamco(supabase, session);
          break;
        case 'angelone':
          logoutSuccess = await logoutAngelOne(supabase, session);
          break;
        case 'upstox':
          logoutSuccess = await logoutUpstox(supabase, session);
          break;
      }

      // Update session status in database
      await supabase
        .from('broker_sessions')
        .update({ 
          session_status: 'logged_out',
          session_token: null
        })
        .eq('id', session.id);

      results.push({
        broker: session.broker,
        userName: session.user_name,
        logoutSuccess,
      });
    }

    console.log('Scheduled logout completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All sessions logged out',
        logoutTime: new Date().toISOString(),
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scheduled logout:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
