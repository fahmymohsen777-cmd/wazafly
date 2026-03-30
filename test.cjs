const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: comps } = await supabaseAdmin.from('companies').select('id, name');
  console.log('Companies:', comps);
  
  const { data: users } = await supabaseAdmin.from('users').select('*, profiles(name, email)');
  console.log('Users:', JSON.stringify(users, null, 2));
}

test();
