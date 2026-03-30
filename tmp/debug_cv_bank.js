import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://auijtttwlkphkngbpogw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWp0dHR3bGtwaGtuZ2Jwb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg0MDI5MiwiZXhwIjoyMDg4NDE2MjkyfQ.C7wbcw9U4s1qVWibYDtHmt05D57cnkdB4doRyE-4_Os';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function testRLSLogic() {
  console.log('--- Diagnosing RLS Team Accounts ---');
  
  // 1. Get all resumes
  const { data: resumes, error: resErr } = await supabaseAdmin.from('resumes').select('id, user_id, name, folder_id');
  if (resErr) { console.error('Error fetching resumes:', resErr); return; }
  console.log(`Found ${resumes.length} resumes total.`);
  if (resumes.length === 0) return;

  // 2. Get distinct user_ids from resumes
  const uploaderIds = [...new Set(resumes.map(r => r.user_id))];
  console.log(`Resumes were uploaded by ${uploaderIds.length} distinct users.`);

  // 3. Get company_id for these uploaders
  const { data: users, error: userErr } = await supabaseAdmin.from('users').select('id, email, company_id, hr_role').in('id', uploaderIds);
  if (userErr) { console.error('Error fetching users:', userErr); return; }

  users.forEach(u => {
      console.log(`User ${u.email} (Role: ${u.hr_role}) belongs to Company: ${u.company_id || 'NONE'}`);
      
      const userResumes = resumes.filter(r => r.user_id === u.id);
      console.log(`  -> Uploaded ${userResumes.length} resumes.`);
      userResumes.forEach(r => console.log(`     - Resume ID: ${r.id}, Name: ${r.name}, Folder: ${r.folder_id}`));
  });

  // 4. Try to find teammates for each company
  for (const u of users) {
      if (u.company_id) {
          const { data: teammates } = await supabaseAdmin.from('users').select('id, email, hr_role').eq('company_id', u.company_id).neq('id', u.id);
          console.log(`User ${u.email} has ${teammates?.length || 0} teammates in the same company:`);
          teammates?.forEach(t => console.log(`  - ${t.email} (${t.hr_role})`));
      }
  }
}

testRLSLogic();
