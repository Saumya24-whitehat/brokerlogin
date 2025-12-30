import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    
    console.log(`Checking Samco session for user: ${userName}`)

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
      .eq('broker_name', 'semco')
      .maybeSingle()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      return new Response(
        JSON.stringify({ success: false, error: 'Session not found', needsRelogin: true }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check session with Samco API - get limits
    console.log('Calling Samco getLimits API...')
    const limitsResponse = await fetch('https://tradeapi.samco.in/limit/getLimits', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-session-token': session.session_token
      }
    })

    const limitsData = await limitsResponse.json()
    console.log('Samco getLimits response status:', limitsData.status)

    const now = new Date().toISOString()

    if (limitsData.status === 'Success') {
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
          limits: limitsData
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Session expired - try to re-login if we have credentials
      console.log('Session expired, attempting re-login...')
      
      if (session.encrypted_password) {
        // Try re-login
        const reloginResponse = await fetch('https://tradeapi.samco.in/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ 
            userId: session.user_name, 
            password: session.encrypted_password 
          })
        })

        const reloginData = await reloginResponse.json()

        if (reloginData.status === 'Success' && reloginData.sessionToken) {
          // Re-login successful - update session
          await supabase
            .from('broker_sessions')
            .update({
              session_token: reloginData.sessionToken,
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
    console.error('Error in samco-check-session:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
