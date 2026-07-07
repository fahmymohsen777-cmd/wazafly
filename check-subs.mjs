import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ndjoxbcedhajbiaihpeo.supabase.co';
const supabaseKey = 'sb_publishable__nMaa2erReFaFMc_Z6qR6w_7q_w2Eiy';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSub() {
  const { data, error } = await supabase.from('subscriptions').select('*');
  console.log("Subscriptions Table:", data);
  console.log("Error:", error);
  
  const { data: users, error: uerror } = await supabase.from('users').select('*');
  console.log("Users Table:", users);
}

checkSub();
