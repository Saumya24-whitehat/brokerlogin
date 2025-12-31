import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Login functions for each broker
async function loginShoonya(supabase: any, session: any): Promise<boolean> {
  try {
    const userId = session.user_name;
    const password = session.encrypted_password;
    const totpSecret = session.encrypted_totp_token;
    const apiKey = session.encrypted_api_key;
    const vendorCode = session.account_name?.split('|')[0] || '';
    const imei = session.account_name?.split('|')[1] || 'abc1234';

    if (!password || !totpSecret || !apiKey) {
      console.log(`Shoonya: Missing credentials for ${userId}`);
      return false;
    }

    // Generate TOTP
    const totp = new OTPAuth.TOTP({
      issuer: 'Shoonya',
      label: userId,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpSecret.replace(/\s/g, '').toUpperCase()),
    });
    const totpCode = totp.generate();

    // Hash password
    const hashedPassword = await sha256Hash(password);
    const appKeyHash = await sha256Hash(`${userId}|${apiKey}`);

    const loginPayload = `jData=${JSON.stringify({
      source: 'API',
      apkversion: 'js:1.0.0',
      uid: userId,
      pwd: hashedPassword,
      factor2: totpCode,
      vc: vendorCode,
      appkey: appKeyHash,
      imei: imei,
    })}`;

    const response = await fetch('https://api.shoonya.com/NorenWClientTP/QuickAuth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginPayload,
    });

    const data = await response.json();
    console.log(`Shoonya login for ${userId}:`, data.stat);

    if (data.stat === 'Ok') {
      await supabase
        .from('broker_sessions')
        .update({
          session_token: data.susertoken,
          session_status: 'active',
          login_time: new Date().toISOString(),
          last_check_time: new Date().toISOString(),
        })
        .eq('id', session.id);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Shoonya login error for ${session.user_name}:`, e);
    return false;
  }
}

async function loginSamco(supabase: any, session: any): Promise<boolean> {
  try {
    const userId = session.user_name;
    const password = session.encrypted_password;

    if (!password) {
      console.log(`Samco: Missing password for ${userId}`);
      return false;
    }

    const response = await fetch('https://tradeapi.samco.in/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userId, password, yob: '' }),
    });

    const data = await response.json();
    console.log(`Samco login for ${userId}:`, data.status);

    if (data.status === 'Success') {
      await supabase
        .from('broker_sessions')
        .update({
          session_token: data.sessionToken,
          session_status: 'active',
          login_time: new Date().toISOString(),
          last_check_time: new Date().toISOString(),
        })
        .eq('id', session.id);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Samco login error for ${session.user_name}:`, e);
    return false;
  }
}

async function loginAngelOne(supabase: any, session: any): Promise<boolean> {
  try {
    const clientCode = session.user_name;
    const password = session.encrypted_password;
    const totpSecret = session.encrypted_totp_token;
    const apiKey = session.encrypted_api_key;

    if (!password || !totpSecret || !apiKey) {
      console.log(`AngelOne: Missing credentials for ${clientCode}`);
      return false;
    }

    // Generate TOTP
    const totp = new OTPAuth.TOTP({
      issuer: 'AngelOne',
      label: clientCode,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpSecret.replace(/\s/g, '').toUpperCase()),
    });
    const totpCode = totp.generate();

    const response = await fetch('https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '00:00:00:00:00:00',
        'X-PrivateKey': apiKey,
      },
      body: JSON.stringify({ clientcode: clientCode, password, totp: totpCode }),
    });

    const data = await response.json();
    console.log(`AngelOne login for ${clientCode}:`, data.status);

    if (data.status === true && data.data?.jwtToken) {
      await supabase
        .from('broker_sessions')
        .update({
          session_token: data.data.jwtToken,
          session_status: 'active',
          login_time: new Date().toISOString(),
          last_check_time: new Date().toISOString(),
        })
        .eq('id', session.id);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`AngelOne login error for ${session.user_name}:`, e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Scheduled login - Starting login for all logged out sessions');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all logged out sessions with credentials
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('*')
      .in('session_status', ['logged_out', 'expired'])
      .not('encrypted_password', 'is', null);

    if (error) {
      console.error('Error fetching sessions:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const session of sessions || []) {
      let loginSuccess = false;

      // Skip Upstox as it requires OAuth
      if (session.broker === 'upstox') {
        results.push({
          broker: session.broker,
          userName: session.user_name,
          loginSuccess: false,
          reason: 'Upstox requires manual OAuth login',
        });
        continue;
      }

      switch (session.broker) {
        case 'shoonya':
          loginSuccess = await loginShoonya(supabase, session);
          break;
        case 'semco':
          loginSuccess = await loginSamco(supabase, session);
          break;
        case 'angelone':
          loginSuccess = await loginAngelOne(supabase, session);
          break;
      }

      results.push({
        broker: session.broker,
        userName: session.user_name,
        loginSuccess,
      });
    }

    console.log('Scheduled login completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Login attempts completed',
        loginTime: new Date().toISOString(),
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scheduled login:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
