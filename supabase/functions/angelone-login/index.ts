import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.2.2";

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
    const { clientCode, password, totpToken, apiKey } = await req.json();
    
    console.log('Angel One login attempt for client:', clientCode);

    // Validate required fields
    if (!clientCode || !password || !totpToken || !apiKey) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'All fields are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Generate TOTP from the secret token using OTPAuth library
    console.log('Generating TOTP from secret token...');
    const totp = new OTPAuth.TOTP({
      issuer: "AngelOne",
      label: clientCode,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: totpToken.replace(/\s/g, '').toUpperCase() // Clean and uppercase the secret
    });
    
    const generatedTotp = totp.generate();
    console.log('TOTP generated successfully');

    // Prepare Angel One login request
    const payload = JSON.stringify({
      clientcode: clientCode,
      password: password,
      totp: generatedTotp
    });

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
      'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
      'X-MACAddress': 'MAC_ADDRESS',
      'X-PrivateKey': apiKey
    };

    console.log('Calling Angel One API...');

    // Make login request to Angel One
    const response = await fetch('https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: headers,
      body: payload
    });

    const data = await response.json();
    console.log('Angel One response status:', data.status);

    // Check if login successful
    if (data.status === true && data.data) {
      const sessionData = data.data;
      
      console.log('Login successful, saving session...');

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Save session to database
      const { error: dbError } = await supabase
        .from('broker_sessions')
        .upsert({
          user_name: clientCode,
          broker_name: 'angelone',
          session_token: sessionData.jwtToken,
          account_id: clientCode,
          account_name: sessionData.name || clientCode,
          exchange_list: sessionData.exchanges || [],
          product_list: sessionData.products || [],
          login_time: new Date().toISOString(),
        }, {
          onConflict: 'user_name,broker_name'
        });

      if (dbError) {
        console.error('Database error:', dbError);
      } else {
        console.log('Session saved to database');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          accountName: sessionData.name || clientCode,
          accountId: clientCode,
          message: 'Login successful! Session saved.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('Login failed:', data.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.message || 'Invalid credentials. Please check your details.'
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
