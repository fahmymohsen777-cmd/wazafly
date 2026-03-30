import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vtnyiueayxijzckhytbh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bnlpdWVheXhpanpja2h5dGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODg0NTMsImV4cCI6MjA3NjE2NDQ1M30.SauU-g36JRMEHnaGOzWrRLwtmbwDWoOQxE8Eq0IsFEU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSub() {
  const { data, error } = await supabase.from('subscriptions').select('*');
  console.log("Subscriptions Table:", data);
  console.log("Error:", error);
  
  const { data: users, error: uerror } = await supabase.from('users').select('*');
  console.log("Users Table:", users);
}

checkSub();
