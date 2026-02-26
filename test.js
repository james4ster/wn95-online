import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gwaiwtgwdqadxmimiskf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YWl3dGd3ZHFhZHhtaW1pc2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTIyMTksImV4cCI6MjA4NjY2ODIxOX0.VH-QhNSFcpNQv3VLi2Zb8riSbF2hIbjVgwBkHLuJqTo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  const { data, error } = await supabase
    .from('player_attributes_by_season')
    .select('*')
    .limit(250);

  console.log({ data, error });
}

testFetch();