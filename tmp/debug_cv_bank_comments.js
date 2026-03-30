import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://auijtttwlkphkngbpogw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWp0dHR3bGtwaGtuZ2Jwb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg0MDI5MiwiZXhwIjoyMDg4NDE2MjkyfQ.C7wbcw9U4s1qVWibYDtHmt05D57cnkdB4doRyE-4_Os';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function testComments() {
  console.log('--- Fetching Comments payload ---');
  const { data: comments, error } = await supabaseAdmin.from('comments').select('*, users(email, hr_role), profiles(name)');
  if (error) { console.error('Error:', error); return; }
  
  if (comments.length === 0) {
      console.log('No comments found in the database. I will insert a dummy one.');
      // Get the first resume
      const { data: resumes } = await supabaseAdmin.from('resumes').select('id, user_id').limit(1);
      if (resumes && resumes.length > 0) {
          const res = resumes[0];
          await supabaseAdmin.from('comments').insert({
              resume_id: res.id,
              text: 'ت',
              user_id: res.user_id
          });
          console.log('Inserted dummy comment. Re-running fetch...');
          const { data: newComments } = await supabaseAdmin.from('comments').select('*, users(email), profiles!comments_user_id_fkey(name)');
          console.log(JSON.stringify(newComments, null, 2));
      }
      return;
  }
  
  console.log(JSON.stringify(comments, null, 2));
}

testComments();
