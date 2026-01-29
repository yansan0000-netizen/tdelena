import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client with service role for guaranteed deletion
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify user token and get user_id
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Invalid token:', userError?.message)
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Clearing all unit_econ_inputs for user: ${user.id}`)

    // First count existing records
    const { count: beforeCount } = await supabase
      .from('unit_econ_inputs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    console.log(`Found ${beforeCount} records to delete`)

    // Delete all records for this user using service_role (bypasses RLS)
    const { error: deleteError } = await supabase
      .from('unit_econ_inputs')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return new Response(JSON.stringify({ error: deleteError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify deletion
    const { count: afterCount } = await supabase
      .from('unit_econ_inputs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    console.log(`After deletion: ${afterCount} records remain`)

    return new Response(JSON.stringify({ 
      success: true, 
      deleted: beforeCount || 0,
      remaining: afterCount || 0
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
