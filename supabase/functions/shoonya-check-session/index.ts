import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.2.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SHA256 hash function
async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userName } = await req.json();
    
    console.log('Shoonya session check for user:', userName);

    if (!userName) {
      return new Response(
        JSON.stringify({ success: false, error: 'User name is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get session from database
    const { data: session, error: dbError } = await supabase
      .from('broker_sessions')
      .select('*')
      .eq('user_name', userName)
      .eq('broker_name', 'shoonya')
      .maybeSingle();

    if (dbError || !session) {
      console.log('No session found for user:', userName);
      return new Response(
        JSON.stringify({ success: false, sessionActive: false, error: 'No session found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found session, checking validity...');

    // Check session using Shoonya user details endpoint
    const checkPayload = {
      uid: userName
    };

    const response = await fetch('https://api.shoonya.com/NorenWClientTP/UserDetails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session_token}`
      },
      body: "jData=" + JSON.stringify(checkPayload) + "&jKey=" + session.session_token
    });

    const responseText = await response.text();
    console.log('Shoonya check response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { stat: 'Not_Ok' };
    }

    const isActive = data.stat === 'Ok';
    console.log('Session active:', isActive);

    // Update last check time
    await supabase
      .from('broker_sessions')
      .update({ 
        last_check_time: new Date().toISOString(),
        session_status: isActive ? 'active' : 'expired'
      })
      .eq('id', session.id);

    // If session expired and we have credentials, try to re-login
    if (!isActive && session.encrypted_password && session.encrypted_totp_token && session.encrypted_api_key) {
      console.log('Session expired, attempting re-login...');

      // Generate new TOTP
      const totp = new OTPAuth.TOTP({
        issuer: "Shoonya",
        label: userName,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: session.encrypted_totp_token.replace(/\s/g, '').toUpperCase()
      });
      
      const generatedTotp = totp.generate();
      const hashedPassword = await sha256Hash(session.encrypted_password);
      const appKeyHash = await sha256Hash(session.encrypted_api_key + "|" + userName);

      // Re-login
      const loginPayload = {
        source: "API",
        apkversion: "1.0.0",
        uid: userName,
        pwd: hashedPassword,
        factor2: generatedTotp,
        vc: "SHOONYA", // Default vendor code
        appkey: appKeyHash,
        imei: "abcd1234"
      };

      const loginResponse = await fetch('https://api.shoonya.com/NorenWClientTP/QuickAuth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: "jData=" + JSON.stringify(loginPayload)
      });

      const loginText = await loginResponse.text();
      let loginData;
      try {
        loginData = JSON.parse(loginText);
      } catch {
        loginData = { stat: 'Not_Ok' };
      }

      if (loginData.stat === 'Ok' && loginData.susertoken) {
        console.log('Re-login successful!');
        
        await supabase
          .from('broker_sessions')
          .update({
            session_token: loginData.susertoken,
            login_time: new Date().toISOString(),
            last_check_time: new Date().toISOString(),
            session_status: 'active'
          })
          .eq('id', session.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            sessionActive: true, 
            reLoginPerformed: true,
            message: 'Session restored successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('Re-login failed:', loginData.emsg);
        return new Response(
          JSON.stringify({ 
            success: true, 
            sessionActive: false, 
            reLoginFailed: true,
            error: loginData.emsg || 'Re-login failed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionActive: isActive,
        lastCheckTime: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred during session check.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
