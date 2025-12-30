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
    const { apiKey, apiSecret, redirectUri, code } = await req.json();
    
    console.log('Upstox auth request received');
    
    // If code is provided, exchange it for access token
    if (code) {
      console.log('Exchanging auth code for access token...');
      
      if (!apiKey || !apiSecret || !redirectUri) {
        return new Response(
          JSON.stringify({ success: false, error: 'API Key, API Secret, and Redirect URI are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Exchange code for access token
      const tokenUrl = 'https://api.upstox.com/v2/login/authorization/token';
      
      const formData = new URLSearchParams();
      formData.append('code', code);
      formData.append('client_id', apiKey);
      formData.append('client_secret', apiSecret);
      formData.append('redirect_uri', redirectUri);
      formData.append('grant_type', 'authorization_code');

      console.log('Requesting token from Upstox...');
      
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
      });

      const tokenData = await tokenResponse.json();
      console.log('Token response status:', tokenResponse.status);
      
      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error('Token exchange failed:', tokenData);
        return new Response(
          JSON.stringify({ success: false, error: tokenData.message || 'Failed to get access token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const accessToken = tokenData.access_token;
      console.log('Access token received successfully');

      // Get user profile
      console.log('Fetching user profile...');
      const profileResponse = await fetch('https://api.upstox.com/v2/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      const profileData = await profileResponse.json();
      console.log('Profile response status:', profileResponse.status);

      if (!profileResponse.ok || profileData.status !== 'success') {
        console.error('Profile fetch failed:', profileData);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch user profile' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const profile = profileData.data;
      const userId = profile.user_id;
      const userName = profile.user_name;
      const email = profile.email;

      console.log(`Profile retrieved for user: ${userId}, name: ${userName}`);

      // Get fund and margin info
      console.log('Fetching fund and margin info...');
      const fundResponse = await fetch('https://api.upstox.com/v2/user/get-funds-and-margin', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      let fundData = null;
      if (fundResponse.ok) {
        const fundResult = await fundResponse.json();
        if (fundResult.status === 'success') {
          fundData = fundResult.data;
          console.log('Fund data retrieved successfully');
        }
      }

      // Store session in Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if session exists and update or insert
      const { data: existingSession } = await supabase
        .from('broker_sessions')
        .select('id')
        .eq('user_name', userId)
        .eq('broker_name', 'upstox')
        .single();

      const sessionData = {
        user_name: userId,
        broker_name: 'upstox',
        session_token: accessToken,
        account_name: userName,
        account_id: email,
        session_status: 'active',
        login_time: new Date().toISOString(),
        last_check_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingSession) {
        const { error: updateError } = await supabase
          .from('broker_sessions')
          .update(sessionData)
          .eq('id', existingSession.id);

        if (updateError) {
          console.error('Error updating session:', updateError);
        } else {
          console.log('Session updated successfully');
        }
      } else {
        const { error: insertError } = await supabase
          .from('broker_sessions')
          .insert(sessionData);

        if (insertError) {
          console.error('Error inserting session:', insertError);
        } else {
          console.log('Session inserted successfully');
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          userId: userId,
          accountName: userName,
          email: email,
          funds: fundData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Generate authorization URL
      if (!apiKey || !redirectUri) {
        return new Response(
          JSON.stringify({ success: false, error: 'API Key and Redirect URI are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
      
      console.log('Generated auth URL');
      
      return new Response(
        JSON.stringify({
          success: true,
          authUrl: authUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('Error in upstox-auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
