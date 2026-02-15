// utils/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// DEV: Hardcode your Supabase URL and anon key to avoid process.env issue
const supabaseUrl = 'https://gwaiwtgwdqadxmimiskf.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YWl3dGd3ZHFhZHhtaW1pc2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTIyMTksImV4cCI6MjA4NjY2ODIxOX0.VH-QhNSFcpNQv3VLi2Zb8riSbF2hIbjVgwBkHLuJqTo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
