import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as OTPAuth from "https://esm.sh/otpauth@9.2.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userName } = await req.json()
    
    console.log(`Checking Angel One session for user: ${userName}`)

    if (!userName) {
      return new Response(
        JSON.stringify({ success: false, error: 'userName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get session from database
    const { data: session, error: sessionError } = await supabase
      .from('broker_sessions')
      .select('*')
      .eq('user_name', userName)
      .eq('broker_name', 'angelone')
      .maybeSingle()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      return new Response(
        JSON.stringify({ success: false, error: 'Session not found', needsRelogin: true }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check session with Angel One API - get RMS limits
    console.log('Calling Angel One getRMS API...')
    const rmsResponse = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getRMS', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
        'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
        'X-MACAddress': 'MAC_ADDRESS',
        'X-PrivateKey': session.encrypted_api_key || '',
        'Authorization': `Bearer ${session.session_token}`
      }
    })

    const rmsData = await rmsResponse.json()
    console.log('Angel One getRMS response status:', rmsData.status)

    const now = new Date().toISOString()

    if (rmsData.status === true && rmsData.data) {
      // Session is alive - update last check time
      await supabase
        .from('broker_sessions')
        .update({ 
          last_check_time: now,
          session_status: 'active'
        })
        .eq('id', session.id)

      console.log('Session is active')
      return new Response(
        JSON.stringify({ 
          success: true, 
          sessionActive: true,
          lastCheckTime: now,
          rms: rmsData.data
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Session expired - try to re-login if we have credentials
      console.log('Session expired, attempting re-login...')
      
      if (session.encrypted_password && session.encrypted_totp_token && session.encrypted_api_key) {
        // Generate new TOTP
        const totp = new OTPAuth.TOTP({
          issuer: "AngelOne",
          label: session.user_name,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: session.encrypted_totp_token.replace(/\s/g, '').toUpperCase()
        })
        const generatedTotp = totp.generate()

        // Try re-login
        const reloginResponse = await fetch('https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
            'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
            'X-MACAddress': 'MAC_ADDRESS',
            'X-PrivateKey': session.encrypted_api_key
          },
          body: JSON.stringify({
            clientcode: session.user_name,
            password: session.encrypted_password,
            totp: generatedTotp
          })
        })

        const reloginData = await reloginResponse.json()

        if (reloginData.status === true && reloginData.data?.jwtToken) {
          // Re-login successful - update session
          await supabase
            .from('broker_sessions')
            .update({
              session_token: reloginData.data.jwtToken,
              last_check_time: now,
              session_status: 'active',
              login_time: now
            })
            .eq('id', session.id)

          console.log('Re-login successful')
          return new Response(
            JSON.stringify({ 
              success: true, 
              sessionActive: true,
              reloggedIn: true,
              lastCheckTime: now
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Re-login failed or no credentials
      await supabase
        .from('broker_sessions')
        .update({ 
          last_check_time: now,
          session_status: 'expired'
        })
        .eq('id', session.id)

      console.log('Session expired and re-login failed')
      return new Response(
        JSON.stringify({ 
          success: false, 
          sessionActive: false,
          needsRelogin: true,
          lastCheckTime: now,
          error: 'Session expired'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in angelone-check-session:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
