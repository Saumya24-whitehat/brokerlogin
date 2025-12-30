import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.2.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SHA256 hash function for Shoonya API
async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, password, totpToken, vendorCode, apiKey, imei } = await req.json();
    
    console.log('Shoonya login attempt for user:', userId);

    // Validate required fields
    if (!userId || !password || !totpToken || !vendorCode || !apiKey) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'All fields are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Generate TOTP from the secret token
    console.log('Generating TOTP from secret token...');
    const totp = new OTPAuth.TOTP({
      issuer: "Shoonya",
      label: userId,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: totpToken.replace(/\s/g, '').toUpperCase()
    });
    
    const generatedTotp = totp.generate();
    console.log('TOTP generated successfully');

    // Hash the password as required by Shoonya API
    const hashedPassword = await sha256Hash(password);
    
    // Generate app key hash (api_key + userId)
    const appKeyHash = await sha256Hash(apiKey + "|" + userId);

    // Prepare Shoonya login request
    const payload = {
      source: "API",
      apkversion: "1.0.0",
      uid: userId,
      pwd: hashedPassword,
      factor2: generatedTotp,
      vc: vendorCode,
      appkey: appKeyHash,
      imei: imei || "abcd1234"
    };

    console.log('Calling Shoonya API...');

    // Make login request to Shoonya (Finvasia NorenAPI)
    const response = await fetch('https://api.shoonya.com/NorenWClientTP/QuickAuth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: "jData=" + JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('Shoonya raw response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Shoonya response');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid response from Shoonya API' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Shoonya response status:', data.stat);

    // Check if login successful
    if (data.stat === 'Ok' && data.susertoken) {
      console.log('Login successful, saving session...');

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if session already exists for this user
      const { data: existingSession } = await supabase
        .from('broker_sessions')
        .select('id')
        .eq('user_name', userId)
        .eq('broker_name', 'shoonya')
        .maybeSingle();

      const sessionData = {
        session_token: data.susertoken,
        account_name: data.uname || userId,
        account_id: data.actid || userId,
        exchange_list: data.exarr || [],
        product_list: [],
        login_time: new Date().toISOString(),
        encrypted_password: password,
        encrypted_totp_token: totpToken,
        encrypted_api_key: apiKey,
        last_check_time: new Date().toISOString(),
        session_status: 'active',
        server_time: data.request_time || null
      };

      if (existingSession) {
        // Update existing session
        console.log('Updating existing Shoonya session for user:', userId);
        const { error: updateError } = await supabase
          .from('broker_sessions')
          .update(sessionData)
          .eq('id', existingSession.id);

        if (updateError) {
          console.error('Error updating session:', updateError);
        }
      } else {
        // Insert new session
        console.log('Creating new Shoonya session for user:', userId);
        const { error: insertError } = await supabase
          .from('broker_sessions')
          .insert({
            user_name: userId,
            broker_name: 'shoonya',
            ...sessionData
          });

        if (insertError) {
          console.error('Error inserting session:', insertError);
        }
      }

      console.log('Shoonya session saved for:', userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          accountName: data.uname || userId,
          accountId: data.actid || userId,
          message: 'Login successful! Session saved.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('Login failed:', data.emsg || 'Unknown error');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.emsg || 'Invalid credentials. Please check your details.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred during login.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
