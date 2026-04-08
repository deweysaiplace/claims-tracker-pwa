const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hmccsbyhubmgrxfamhfw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_b8AXhrbQDkVdfzz_p1ZiQw_koRnf7kG';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLogs() {
  console.log("Checking error_logs table...");
  const { data, error } = await supabase
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
  } else {
    console.log("Latest Logs:", JSON.stringify(data, null, 2));
  }
}

checkLogs();
