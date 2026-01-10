import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://pemefhucwmizzttgibcm.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_P_6Taa7vzhn6LcKxF0kYbg_KYXNsowX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);