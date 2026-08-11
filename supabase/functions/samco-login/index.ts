import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SamcoLoginRequest {
  userId: string
  password: string
  accessToken?: string
}

interface SamcoLoginResponse {
  status: string
  statusMessage?: string
  sessionToken?: string
  accountID?: string
  accountName?: string
  serverTime?: string
  exchangeList?: string[]
  orderTypeList?: string[]
  productList?: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId, password }: SamcoLoginRequest = await req.json()
    
    console.log(`Attempting login for user: ${userId}`)

    // Validate inputs
    if (!userId || !password) {
      console.error('Missing userId or password')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'userId and password are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call Samco API
    console.log('Calling Samco login API...')
    const samcoResponse = await fetch('https://tradeapi.samco.in/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ userId, password })
    })

    const samcoData: SamcoLoginResponse = await samcoResponse.json()
    console.log('Samco API response status:', samcoData.status)

    if (samcoData.status === 'Success' && samcoData.sessionToken) {
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Check if session already exists for this user
      const { data: existingSession } = await supabase
        .from('broker_sessions')
        .select('id')
        .eq('user_name', userId)
        .eq('broker_name', 'semco')
        .maybeSingle()

      if (existingSession) {
        // Update existing session
        console.log('Updating existing session for user:', userId)
        const { error: updateError } = await supabase
          .from('broker_sessions')
          .update({
            session_token: samcoData.sessionToken,
            account_id: samcoData.accountID,
            account_name: samcoData.accountName,
            server_time: samcoData.serverTime,
            exchange_list: samcoData.exchangeList,
            order_type_list: samcoData.orderTypeList,
            product_list: samcoData.productList,
            login_time: new Date().toISOString(),
            encrypted_password: password,
            last_check_time: new Date().toISOString(),
            session_status: 'active'
          })
          .eq('id', existingSession.id)

        if (updateError) {
          console.error('Error updating session:', updateError)
        }
      } else {
        // Insert new session
        console.log('Creating new session for user:', userId)
        const { error: insertError } = await supabase
          .from('broker_sessions')
          .insert({
            user_name: userId,
            broker_name: 'semco',
            session_token: samcoData.sessionToken,
            account_id: samcoData.accountID,
            account_name: samcoData.accountName,
            server_time: samcoData.serverTime,
            exchange_list: samcoData.exchangeList,
            order_type_list: samcoData.orderTypeList,
            product_list: samcoData.productList,
            encrypted_password: password,
            last_check_time: new Date().toISOString(),
            session_status: 'active'
          })

        if (insertError) {
          console.error('Error inserting session:', insertError)
        }
      }

      console.log('Login successful, session saved for:', userId)
      
      return new Response(
        JSON.stringify({
          success: true,
          accountName: samcoData.accountName,
          accountId: samcoData.accountID,
          message: 'Login successful! Session saved.'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.error('Samco login failed:', samcoData.statusMessage)
      return new Response(
        JSON.stringify({
          success: false,
          error: samcoData.statusMessage || 'Login failed. Please check your credentials.'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  } catch (error) {
    console.error('Error in samco-login function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An error occurred while processing your request.' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
